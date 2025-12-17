local typing = false

RegisterNetEvent('aprts_computer:client:startTypingAnim', function()
    if typing then return end
    typing = true
    local ped = PlayerPedId()
    RequestAnimDict("amb@world_human_seat_wall_tablet@female@base")
    while not HasAnimDictLoaded("amb@world_human_seat_wall_tablet@female@base") do Wait(0) end
    TaskPlayAnim(ped, "amb@world_human_seat_wall_tablet@female@base", "base", 8.0, -8.0, -1, 49, 0, false, false, false)
end)

RegisterNetEvent('aprts_computer:client:stopTypingAnim', function()
    typing = false
    ClearPedTasks(PlayerPedId())
end)