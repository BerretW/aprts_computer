local QBCore = exports['qb-core']:GetCoreObject()

-- Stavové proměnné
local isPcOpen = false
local currentPcId = nil
local currentHwLimits = {}
local registeredApps = {} -- Externí aplikace

-- Seznam modelů PC, na které bude fungovat Target
local pcModels = {
    'ba_prop_battle_club_computer_01', -- Tvůj požadovaný model
    'prop_pc_desktop_01',
    'prop_pc_desktop_02',
    'xm_prop_x17_desktop_pc',
    'prop_monitor_w_keyboard', -- Často používaný v interiérech
    'ch_prop_arcade_monitor_01a',
    -- Přidej další modely dle potřeby
}

-- ====================================================================
-- POMOCNÉ FUNKCE
-- ====================================================================

-- Generuje unikátní ID na základě pozice entity (zaokrouhleno na celá čísla)
-- Příklad výstupu: "PC-125-540-30"
local function GetComputerIdFromEntity(entity)
    local coords = GetEntityCoords(entity)
    -- Zaokrouhlíme, aby drobné odchylky v pozici neměnily ID
    local x = math.floor(coords.x)
    local y = math.floor(coords.y)
    local z = math.floor(coords.z)
    
    return string.format("PC-%d-%d-%d", x, y, z)
end

-- ====================================================================
-- EXPORTS API (Pro externí scripty)
-- ====================================================================

exports('RegisterApp', function(appId, label, icon, color, eventName)
    registeredApps[appId] = {
        id = appId,
        label = label,
        icon = icon,
        color = color,
        event = eventName
    }
    if isPcOpen then
        SendNUIMessage({ action = "addExternalApp", app = registeredApps[appId] })
    end
end)

exports('OpenWindow', function(appId, title, htmlContent, width, height)
    if not isPcOpen then return end
    SendNUIMessage({
        action = "openExternalWindow",
        appId = appId,
        title = title,
        content = htmlContent,
        width = width,
        height = height
    })
end)

exports('GetSystemData', function()
    if not isPcOpen then return nil end
    return {
        pcId = currentPcId,
        hw = currentHwLimits,
        isOpen = isPcOpen
    }
end)

-- ====================================================================
-- SERVER EVENTS
-- ====================================================================

RegisterNetEvent('aprts_computer:client:openLogin', function(pcId, users)
    currentPcId = pcId
    isPcOpen = true
    SetNuiFocus(true, true)
    
    SendNUIMessage({
        action = "showLogin",
        pcId = pcId,
        users = users
    })
end)

RegisterNetEvent('aprts_computer:client:loadDesktop', function(pcId, pcData, hwInfo)
    currentHwLimits = hwInfo
    currentPcId = pcId
    
    -- Animace (pokud je to laptop)
    if string.find(pcId, "LAP-") then
        TriggerEvent('aprts_computer:client:startTypingAnim')
    end

    SendNUIMessage({
        action = "loadDesktop",
        files = pcData.filesystem or {},
        apps = pcData.installedApps or {},
        settings = pcData.settings or { themeColor = "#0078d7" },
        hwInfo = hwInfo,
        externalApps = registeredApps
    })
end)

RegisterNetEvent('aprts_computer:client:refreshFiles', function(files)
    SendNUIMessage({ action = "refreshFiles", files = files })
end)

-- ====================================================================
-- NUI CALLBACKS
-- ====================================================================

RegisterNUICallback('loginAttempt', function(data, cb)
    TriggerServerEvent('aprts_computer:server:loginSuccess', currentPcId, data.user)
    cb('ok')
end)

RegisterNUICallback('hide', function(_, cb)
    SetNuiFocus(false, false)
    TriggerEvent('aprts_computer:client:stopTypingAnim')
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb)
    isPcOpen = false
    currentPcId = nil
    SetNuiFocus(false, false)
    TriggerEvent('aprts_computer:client:stopTypingAnim')
    cb('ok')
end)

RegisterNUICallback('saveFile', function(data, cb)
    TriggerServerEvent('aprts_computer:server:saveFile', currentPcId, data.pathArray, data.fileName, data.content, data.extension)
    cb('ok')
end)

RegisterNUICallback('fileOperation', function(data, cb)
    if data.action == 'delete' then
        TriggerServerEvent('aprts_computer:server:deleteFile', currentPcId, data.fileName)
    elseif data.action == 'move' then
        TriggerServerEvent('aprts_computer:server:moveFile', currentPcId, data.fileName, data.targetPath)
    end
    cb('ok')
end)

RegisterNUICallback('saveSettings', function(data, cb)
TriggerServerEvent('aprts_computer:server:saveSettings', currentPcId, data)
cb('ok')
end)
RegisterNUICallback('createFolder', function(data, cb)
TriggerServerEvent('aprts_computer:server:createFolder', currentPcId, data.pathArray, data.folderName)
cb('ok')
end)
RegisterNUICallback('windowClosed', function(_, cb)
    cb('ok')
end)

RegisterNUICallback('launchExternalApp', function(data, cb)
    local app = registeredApps[data.appId]
    if app and app.event then
        TriggerEvent(app.event, currentPcId)
    end
    cb('ok')
end)


-- ====================================================================
-- TARGET & INTERACTION (ox_target)
-- ====================================================================

CreateThread(function()
    -- 1. MODELY (Prop)
    -- Automaticky najde všechny PC objekty na mapě
    exports.ox_target:addModel(pcModels, {
        {
            name = 'open_desktop_pc',
            label = 'Zapnout Počítač',
            icon = 'fas fa-power-off',
            distance = 1.5,
            onSelect = function(data)
                -- Generujeme ID podle pozice entity
                -- Tím zajistíme, že tento konkrétní stůl bude mít vždy stejná data
                local id = GetComputerIdFromEntity(data.entity)
                
                -- Animace pro hráče (sedí u stolu?)
                -- Zde by se dalo přidat TaskStartScenarioAtPosition, pokud je potřeba

                TriggerServerEvent('aprts_computer:server:boot', id)
            end
        },
        -- Můžeme přidat další možnosti, např. "Vložit USB" (jen animace/logika)
        {
            name = 'insert_usb_drive',
            label = 'Vložit USB Flashdisk',
            icon = 'fab fa-usb',
            distance = 1.5,
            canInteract = function(entity)
                -- Zde kontrola, zda má hráč USB v inventáři
                local count = exports.ox_inventory:Search('count', 'usb_stick')
                return count > 0
            end,
            onSelect = function(data)
                -- Logika pro USB
                -- TriggerServerEvent('aprts_computer:server:insertUsb', GetComputerIdFromEntity(data.entity))
            end
        }
    })

    -- 2. STATICKÉ ZÓNY (Config.StaticComputers)
    -- Pokud chceš definovat neviditelné zóny v Configu (např. na stolech bez propů)
    if Config.StaticComputers then
        for i, pc in ipairs(Config.StaticComputers) do
            exports.ox_target:addSphereZone({
                coords = pc.coords,
                radius = pc.radius or 0.6,
                options = {{
                    name = 'open_static_pc_'..i,
                    icon = 'fas fa-desktop',
                    label = pc.label or 'Použít počítač',
                    groups = pc.job, -- Pokud je PC jen pro policii atd.
                    onSelect = function()
                        -- Zde použijeme ID definované v Configu, nebo generujeme podle i
                        local id = pc.id or ("STATIC-ZONE-"..i)
                        TriggerServerEvent('aprts_computer:server:boot', id)
                    end
                }}
            })
        end
    end
end)

-- Příkaz pro debug / použití laptopu
RegisterCommand("laptop", function()
    -- Generuje náhodné ID pro laptop, nebo sériové číslo itemu
    TriggerServerEvent('aprts_computer:server:boot', "LAP-DEMO")
end)