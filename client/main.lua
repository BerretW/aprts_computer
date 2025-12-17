local QBCore = exports['qb-core']:GetCoreObject()

-- Stavové proměnné
local isPcOpen = false
local currentPcId = nil
local openWindowsCount = 0
local currentHwLimits = { 
    ramMax = 3,  -- Default (např. 4GB RAM)
    hddMax = 250 -- Default MB
}

-- Animace (pro Laptop)
local function StartLaptopAnimation()
    local ped = PlayerPedId()
    RequestAnimDict("anim@heists@prison_heistig1_p1_guard_checks_bus")
    while not HasAnimDictLoaded("anim@heists@prison_heistig1_p1_guard_checks_bus") do Wait(10) end
    TaskPlayAnim(ped, "anim@heists@prison_heistig1_p1_guard_checks_bus", "loop", 8.0, -8.0, -1, 49, 0, false, false, false)
end

local function StopLaptopAnimation()
    local ped = PlayerPedId()
    ClearPedTasks(ped)
end

-- ====================================================================
-- OTEVÍRÁNÍ A KOMUNIKACE SE SERVEREM
-- ====================================================================

-- 1. Krok: Otevření Login obrazovky (Server poslal data o uživatelích)
RegisterNetEvent('aprts_computer:client:openLogin', function(pcId, usersData)
    currentPcId = pcId
    isPcOpen = true
    openWindowsCount = 0 -- Reset oken
    SetNuiFocus(true, true)
    
    SendNUIMessage({
        action = "showLogin",
        pcId = pcId,
        users = usersData
    })
end)

-- 2. Krok: Úspěšné přihlášení -> Načtení plochy a HW limitů
RegisterNetEvent('aprts_computer:client:loadDesktop', function(pcId, pcData, hwInfo)
    currentHwLimits = hwInfo or currentHwLimits
    
    -- Pokud je to laptop, spustíme animaci
    if string.find(pcId, "LAP-") then
        StartLaptopAnimation()
    end

    SendNUIMessage({
        action = "loadDesktop",
        files = pcData.filesystem or {},
        apps = pcData.installedApps or {},
        settings = pcData.settings or { themeColor = "#0078d7", wallpaper = "" },
        hwInfo = hwInfo -- Pošleme info i do JS pro zobrazení "Tento Počítač"
    })
end)

-- Aktualizace souborů (např. po uložení)
RegisterNetEvent('aprts_computer:client:refreshFiles', function(newFiles)
    SendNUIMessage({
        action = "refreshFiles",
        files = newFiles
    })
end)

-- Výsledek skenu USB
RegisterNetEvent('aprts_computer:client:usbScanResult', function(list)
    SendNUIMessage({ action = "usbResult", list = list })
end)

-- Aktualizace Miner aplikace (pokud běží)
RegisterNetEvent('aprts_computer:client:updateMiner', function(amount)
    SendNUIMessage({ action = "updateMiner", amount = amount })
end)

-- ====================================================================
-- NUI CALLBACKS (Logika klienta)
-- ====================================================================

RegisterNUICallback('loginAttempt', function(data, cb)
    TriggerServerEvent('aprts_computer:server:loginAttempt', currentPcId, data.user, data.pass)
    cb('ok')
end)

-- Kontrola RAM před otevřením okna
RegisterNUICallback('checkRamLimit', function(data, cb)
    if openWindowsCount >= currentHwLimits.ramMax then
        -- Zamítnuto: Nedostatek RAM
        cb(false)
    else
        openWindowsCount = openWindowsCount + 1
        cb(true)
    end
end)

-- Snížení počtu oken při zavření
RegisterNUICallback('windowClosed', function(data, cb)
    openWindowsCount = openWindowsCount - 1
    if openWindowsCount < 0 then openWindowsCount = 0 end
    cb('ok')
end)

RegisterNUICallback('saveFile', function(data, cb)
    TriggerServerEvent('aprts_computer:server:saveFile', currentPcId, data.path, data.content, data.extension)
    cb('ok')
end)

RegisterNUICallback('scanUsb', function(data, cb)
    TriggerServerEvent('aprts_computer:server:checkUsb', currentPcId)
    cb('ok')
end)

RegisterNUICallback('installApp', function(data, cb)
    TriggerServerEvent('aprts_computer:server:installApp', currentPcId, data.appName)
    cb('ok')
end)

RegisterNUICallback('saveSettings', function(data, cb)
    TriggerServerEvent('aprts_computer:server:saveSettings', currentPcId, data)
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb)
    isPcOpen = false
    SetNuiFocus(false, false)
    StopLaptopAnimation()
    cb('ok')
end)

-- ====================================================================
-- INTERAKCE (Target & Items)
-- ====================================================================

-- Použití itemu Laptop (Export pro ox_inventory)
exports('useLaptop', function(data)
    local serial = data.metadata.serial
    if not serial then 
        serial = "LAP-" .. math.random(100000, 999999)
        -- Zde by se měl ideálně updatovat item serial, pokud neexistuje
    end
    TriggerServerEvent('aprts_computer:server:boot', serial)
end)

RegisterCommand("laptop", function()
TriggerServerEvent('aprts_computer:server:boot', "LAP-1")
end)

-- Target pro statické PC (pokud používáte ox_target)
CreateThread(function()
    if Config.StaticComputers then
        for i, pc in ipairs(Config.StaticComputers) do
            exports.ox_target:addSphereZone({
                coords = pc.coords,
                radius = 0.6,
                options = {{
                    name = 'open_pc_'..i,
                    icon = 'fas fa-desktop',
                    label = pc.label or 'Použít počítač',
                    onSelect = function()
                        local id = "STATIC-"..i
                        TriggerServerEvent('aprts_computer:server:boot', id)
                    end,
                    groups = pc.job
                }}
            })
        end
    end
end)