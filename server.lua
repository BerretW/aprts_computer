local QBCore = exports['qb-core']:GetCoreObject()
local ActivePCs = {} -- Zde ukládáme běžící PC (runtime data)

-- ====================================================================
-- 1. HARDWARE & BACKGROUND THREAD
-- ====================================================================

-- Hlavní smyčka serveru (Běží každou vteřinu, ale PC řeší podle jejich CPU)
CreateThread(function()
    while true do
        local now = os.time()
        
        for pcId, pcRuntime in pairs(ActivePCs) do
            -- Zkontrolujeme, zda nastal čas pro TICK tohoto PC
            if now >= pcRuntime.nextTick then
                ProcessPCTick(pcId, pcRuntime)
                
                -- Nastavíme další tick podle CPU
                local cpuItem = pcRuntime.specs.cpu
                local tickRate = Config.Hardware.cpu[cpuItem].tickRate or 20
                pcRuntime.nextTick = now + tickRate
            end
        end
        
        Wait(1000) -- Kontrola každou sekundu
    end
end)

function ProcessPCTick(pcId, pcRuntime)
    -- Tady běží background logiky (např. Miner)
    -- Získáme násobič GPU
    local gpuItem = pcRuntime.specs.gpu
    local multiplier = Config.Hardware.gpu[gpuItem].multiplier or 1.0

    -- Příklad: Pokud běží miner (uloženo v runtime datech)
    if pcRuntime.runningTasks['miner'] then
        local earned = math.random(1, 5) * multiplier
        -- Přičíst peníze/crypto někam (např. do souboru v PC nebo SQL)
        print(string.format("[PC: %s] Mining tick... Zisk: %.2f (GPU Multi: %.1f)", pcId, earned, multiplier))
        
        -- Event do clienta (pokud je někdo u PC), aby viděl update grafu
        if pcRuntime.activeUserSource then
            TriggerClientEvent('aprts_computer:client:updateMiner', pcRuntime.activeUserSource, earned)
        end
    end
end

-- ====================================================================
-- 2. BOOT & LOGIN
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
            users = {{ username = "admin", password = "", isOwner = true }}, -- Default bez hesla
            filesystem = {
                { name = "Dokumenty", type = "folder", children = {} },
                { name = "Obrázky", type = "folder", children = {} },
                { name = "readme.txt", type = "file", extension = "txt", content = "Vítejte v novém PC!" }
            },
            installedApps = {'settings', 'notepad', 'files', 'browser'}
        }
        exports.oxmysql:insert('INSERT INTO player_computers (id, data) VALUES (?, ?)', { pcId, json.encode(data) })
    end

    -- Registrace do ActivePCs (Zapnutí PC)
    if not ActivePCs[pcId] then
        ActivePCs[pcId] = {
            specs = data.hardware,
            nextTick = os.time(),
            runningTasks = {}, -- Seznam běžících úloh na pozadí
            activeUserSource = src -- Kdo u toho sedí
        }
    else
        ActivePCs[pcId].activeUserSource = src
    end

    TriggerClientEvent('aprts_computer:client:openLogin', src, pcId, data.users)
end)

-- Login success -> Načtení plochy
RegisterNetEvent('aprts_computer:server:loginSuccess', function(pcId, username)
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        
        -- Přidáme info o HW limitech pro Clienta
        local hwInfo = {
            ramMax = Config.Hardware.ram[data.hardware.ram].maxApps,
            hddMax = Config.Hardware.hdd[data.hardware.hdd].capacity
        }

        TriggerClientEvent('aprts_computer:client:loadDesktop', src, pcId, data, hwInfo)
    end
end)

-- ====================================================================
-- 3. FILESYSTEM OPERATIONS
-- ====================================================================

RegisterNetEvent('aprts_computer:server:saveFile', function(pcId, path, content, extension)
    -- Zde by byla složitá logika pro rekurzivní hledání ve stromu podle cesty
    -- Pro zjednodušení ukládáme plochý seznam v tomto příkladu, 
    -- ale v reálu by to chtělo funkci `FindFolderByPath(root, path)`
    
    local src = source
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        
        -- Jednoduchá implementace (vše do rootu pro ukázku)
        local fileFound = false
        for _, file in ipairs(data.filesystem) do
            if file.name == path and file.type == 'file' then
                file.content = content
                fileFound = true
                break
            end
        end

        if not fileFound then
            table.insert(data.filesystem, {
                name = path, -- v reálu název souboru
                type = 'file',
                extension = extension,
                content = content,
                created = os.time()
            })
        end

        exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
        TriggerClientEvent('aprts_computer:client:refreshFiles', src, data.filesystem)
    end
end)

-- ====================================================================
-- 4. HARDWARE UPGRADE
-- ====================================================================

-- Callback volaný z itemu (použití itemu na PC)
RegisterNetEvent('aprts_computer:server:upgradeComponent', function(pcId, type, itemData)
    -- type = 'ram', 'gpu', ...
    -- itemData = { item = 'ram_32gb' }
    
    local result = exports.oxmysql:singleSync('SELECT data FROM player_computers WHERE id = ?', {pcId})
    if result then
        local data = json.decode(result.data)
        
        -- Výměna komponenty
        local oldComponent = data.hardware[type]
        data.hardware[type] = itemData.item
        
        -- Uložit
        exports.oxmysql:update('UPDATE player_computers SET data = ? WHERE id = ?', {json.encode(data), pcId})
        
        -- Vrátit hráči starou komponentu
        if oldComponent then
            exports.ox_inventory:AddItem(source, oldComponent, 1)
        end
        exports.ox_inventory:RemoveItem(source, itemData.item, 1)
        
        -- Update ActivePCs pokud běží
        if ActivePCs[pcId] then
            ActivePCs[pcId].specs = data.hardware
        end
    end
end)