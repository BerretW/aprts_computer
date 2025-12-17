local ActivePCs = {} 

-- ====================================================================
-- POMOCNÉ FUNKCE (FILESYSTEM)
-- ====================================================================

local function CalculateUsedSpace(filesystem)
    local totalSize = 0
    local function recurse(items)
        for _, item in ipairs(items) do
            if item.type == 'file' and item.content then
                totalSize = totalSize + string.len(item.content)
            elseif item.type == 'folder' then
                recurse(item.children)
            end
        end
    end
    recurse(filesystem)
    return totalSize / (1024 * 1024) -- MB
end

local function FindFolder(root, pathArray)
    local currentDir = root
    for _, folderName in ipairs(pathArray) do
        local found = false
        for _, item in ipairs(currentDir) do
            if item.type == 'folder' and item.name == folderName then
                currentDir = item.children
                found = true
                break
            end
        end
        -- Pokud složka neexistuje, vytvoříme ji
        if not found then
            local newFolder = { name = folderName, type = 'folder', children = {} }
            table.insert(currentDir, newFolder)
            currentDir = newFolder.children
        end
    end
    return currentDir
end

local function DeleteFileRecursive(folder, targetName)
    for i, item in ipairs(folder) do
        if item.name == targetName then
            table.remove(folder, i)
            return true, item
        elseif item.type == 'folder' then
            local deleted, deletedItem = DeleteFileRecursive(item.children, targetName)
            if deleted then return true, deletedItem end
        end
    end
    return false, nil
end

-- ====================================================================
-- HLAVNÍ LOOP (CPU TICKS)
-- ====================================================================

CreateThread(function()
    while true do
        local now = os.time()
        for pcId, pcRuntime in pairs(ActivePCs) do
            if now >= pcRuntime.nextTick then
                -- Zde se vykonávají background tasky (např. mining)
                if pcRuntime.runningTasks['miner'] then
                    local gpuItem = pcRuntime.specs.gpu
                    local multiplier = Config.Hardware.gpu[gpuItem].multiplier or 1.0
                    local earned = math.random(1, 3) * multiplier
                    -- Odeslat info klientovi
                    if pcRuntime.activeUserSource then
                        TriggerClientEvent('aprts_computer:client:updateMiner', pcRuntime.activeUserSource, earned)
                    end
                end
                
                -- Nastavit další tick
                local cpuItem = pcRuntime.specs.cpu
                local tickRate = Config.Hardware.cpu[cpuItem].tickRate or 20
                pcRuntime.nextTick = now + tickRate
            end
        end
        Wait(1000)
    end
end)

-- ====================================================================
-- BOOT & LOGIN
-- ====================================================================

RegisterNetEvent('aprts_computer:server:boot', function(pcId)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT * FROM player_computers WHERE id = ?', {pcId})
    local data = {}

    if result then
        data = json.decode(result.data)
    else
        data = {
            hardware = Config.DefaultSpecs,
            users = {{ username = "admin", password = "", isOwner = true }},
            filesystem = {
                { name = "Dokumenty", type = "folder", children = {} },
                { name = "readme.txt", type = "file", extension = "txt", content = "Vitejte v OS!" }
            },
            installedApps = {'settings', 'notepad', 'files'}
        }
        exports.oxmysql:insert('INSERT INTO player_computers (id, data) VALUES (?, ?)', { pcId, json.encode(data) })
    end

    ActivePCs[pcId] = {
        specs = data.hardware,
        nextTick = os.time(),
        runningTasks = {},
        activeUserSource = src
    }

    TriggerClientEvent('aprts_computer:client:openLogin', src, pcId, data.users)
end)

RegisterNetEvent('aprts_computer:server:loginSuccess', function(pcId, username)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        local hwInfo = {
            ramMax = Config.Hardware.ram[data.hardware.ram].maxApps,
            hddMax = Config.Hardware.hdd[data.hardware.hdd].capacity,
            cpu = Config.Hardware.cpu[data.hardware.cpu].label
        }
        -- Přidáme info o aktuálním uživateli
        data.currentUser = { username = username }

        TriggerClientEvent('aprts_computer:client:loadDesktop', src, pcId, data, hwInfo)
    end
end)

-- ====================================================================
-- FILESYSTEM OPERACE
-- ====================================================================

RegisterNetEvent('aprts_computer:server:saveFile', function(pcId, pathArray, fileName, content, extension)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        
        -- Kontrola HDD
        local used = CalculateUsedSpace(data.filesystem)
        local sizeMB = string.len(content) / (1024 * 1024)
        local max = Config.Hardware.hdd[data.hardware.hdd].capacity
        
        if (used + sizeMB) > max then
            TriggerClientEvent('ox_lib:notify', src, {type='error', description='Disk je plný!'})
            return
        end

        local targetDir = FindFolder(data.filesystem, pathArray)
        
        -- Update nebo Insert
        local found = false
        for _, item in ipairs(targetDir) do
            if item.name == fileName and item.type == 'file' then
                item.content = content
                found = true
                break
            end
        end
        if not found then
            table.insert(targetDir, { name = fileName, type = 'file', extension = extension, content = content })
        end

        exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
        TriggerClientEvent('aprts_computer:client:refreshFiles', src, data.filesystem)
    end
end)

RegisterNetEvent('aprts_computer:server:deleteFile', function(pcId, fileName)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        local success = DeleteFileRecursive(data.filesystem, fileName)
        if success then
            exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
            TriggerClientEvent('aprts_computer:client:refreshFiles', src, data.filesystem)
        end
    end
end)

RegisterNetEvent('aprts_computer:server:moveFile', function(pcId, fileName, targetPathArray)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        
        -- 1. Vyjmout
        local success, item = DeleteFileRecursive(data.filesystem, fileName)
        
        -- 2. Vložit
        if success and item then
            local targetDir = FindFolder(data.filesystem, targetPathArray)
            table.insert(targetDir, item)
            
            exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
            TriggerClientEvent('aprts_computer:client:refreshFiles', src, data.filesystem)
        end
    end
end)