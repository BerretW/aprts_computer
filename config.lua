Config = {}
Config.Debug = false

-- Hardwarové komponenty
Config.Hardware = {
    cpu = {
        ['cpu_celeron'] = { label = "Intel Celeron", tickRate = 20 },
        ['cpu_i5'] = { label = "Intel Core i5", tickRate = 10 },
        ['cpu_i9'] = { label = "Intel Core i9", tickRate = 5 },
    },
    gpu = {
        ['gpu_integrated'] = { label = "Integrated Graphics", multiplier = 0.5 },
        ['gpu_1050'] = { label = "GTX 1050", multiplier = 1.0 },
        ['gpu_3090'] = { label = "RTX 3090", multiplier = 3.0 },
    },
    ram = {
        ['ram_4gb'] = { label = "4GB RAM", maxApps = 2 },
        ['ram_8gb'] = { label = "8GB RAM", maxApps = 5 },
        ['ram_32gb'] = { label = "32GB RAM", maxApps = 10 },
    },
    hdd = {
        ['hdd_250gb'] = { label = "250GB HDD", capacity = 250 }, -- MB
        ['ssd_1tb'] = { label = "1TB SSD", capacity = 1000 },
    }
}

-- Asociace souborů
Config.FileExtensions = {
    ['txt'] = 'notepad',
    ['png'] = 'photo_viewer',
    ['min'] = 'miner_app'
}

-- Defaultní PC
Config.DefaultSpecs = {
    cpu = 'cpu_celeron',
    gpu = 'gpu_integrated',
    ram = 'ram_4gb',
    hdd = 'hdd_250gb'
}

-- Statická PC ve světě (volitelné)
Config.StaticComputers = {
    -- { coords = vec3(441.5, -978.8, 30.7), job = 'police', label = 'Policejní PC' }
}