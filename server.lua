local ActivePCs = {} 

-- ====================================================================
-- POMOCNÉ FUNKCE (FILESYSTEM)
-- ====================================================================

-- Spočítá využité místo na disku v MB
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
    return totalSize / (1024 * 1024) -- Převod na MB
end

-- Najde cílovou složku podle pole cest (např. ['Users', 'Admin'])
-- Vrací referenci na tabulku (children)
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
        -- Pokud složka neexistuje (např. při ukládání souboru do nové cesty), vytvoříme ji
        if not found then
            local newFolder = { name = folderName, type = 'folder', children = {} }
            table.insert(currentDir, newFolder)
            currentDir = newFolder.children
        end
    end
    return currentDir
end

-- Rekurzivně najde a smaže soubor/složku. Vrací (bool success, table deletedItem)
local function DeleteFileRecursive(folder, targetName)
    for i, item in ipairs(folder) do
        if item.name == targetName then
            local removedItem = table.remove(folder, i)
            return true, removedItem
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
                    local multiplier = Config.Hardware.gpu[gpuItem] and Config.Hardware.gpu[gpuItem].multiplier or 1.0
                    local earned = math.random(1, 3) * multiplier
                    -- Odeslat info klientovi
                    if pcRuntime.activeUserSource then
                        TriggerClientEvent('aprts_computer:client:updateMiner', pcRuntime.activeUserSource, earned)
                    end
                end
                
                -- Nastavit další tick
                local cpuItem = pcRuntime.specs.cpu
                local tickRate = Config.Hardware.cpu[cpuItem] and Config.Hardware.cpu[cpuItem].tickRate or 20
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
        -- Inicializace nového PC
        data = {
            hardware = Config.DefaultSpecs,
            users = {{ username = "admin", password = "", isOwner = true }},
            filesystem = {
                { name = "Dokumenty", type = "folder", children = {} },
                { name = "System", type = "folder", children = {} },
                { name = "readme.txt", type = "file", extension = "txt", content = "Vitejte v OS v3.0!" }
            },
            installedApps = {'settings', 'notepad', 'files'},
            settings = { themeColor = "#0078d7" }
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
        
        -- Fallbacky pro případ chybějících dat v Configu nebo DB
        local ramConf = Config.Hardware.ram[data.hardware.ram] or { maxApps = 3 }
        local hddConf = Config.Hardware.hdd[data.hardware.hdd] or { capacity = 250 }
        local cpuConf = Config.Hardware.cpu[data.hardware.cpu] or { label = "Unknown CPU" }

        local hwInfo = {
            ramMax = ramConf.maxApps,
            hddMax = hddConf.capacity,
            cpu = cpuConf.label
        }
        
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
        
        -- 1. Kontrola kapacity HDD
        local used = CalculateUsedSpace(data.filesystem)
        local sizeMB = string.len(content) / (1024 * 1024)
        local hddConf = Config.Hardware.hdd[data.hardware.hdd] or { capacity = 250 }
        
        if (used + sizeMB) > hddConf.capacity then
            TriggerClientEvent('ox_lib:notify', src, {type='error', description='Disk je plný!'})
            return
        end

        -- 2. Nalezení složky a uložení
        local targetDir = FindFolder(data.filesystem, pathArray)
        
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

RegisterNetEvent('aprts_computer:server:createFolder', function(pcId, pathArray, folderName)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        local targetDir = FindFolder(data.filesystem, pathArray)
        
        -- Kontrola duplicit
        for _, item in ipairs(targetDir) do
            if item.name == folderName then
                TriggerClientEvent('ox_lib:notify', src, {type='error', description='Složka s tímto názvem již existuje!'})
                return
            end
        end

        table.insert(targetDir, { name = folderName, type = 'folder', children = {} })
        
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
        
        -- 1. Vyjmout (rekurzivně hledá kdekoli)
        local success, item = DeleteFileRecursive(data.filesystem, fileName)
        
        -- 2. Vložit do cíle
        if success and item then
            local targetDir = FindFolder(data.filesystem, targetPathArray)
            table.insert(targetDir, item)
            
            exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
            TriggerClientEvent('aprts_computer:client:refreshFiles', src, data.filesystem)
            TriggerClientEvent('ox_lib:notify', src, {type='success', description='Položka přesunuta'})
        else
            TriggerClientEvent('ox_lib:notify', src, {type='error', description='Chyba při přesunu'})
        end
    end
end)

RegisterNetEvent('aprts_computer:server:saveSettings', function(pcId, settingsData)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        data.settings = settingsData
        exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
    end
end)