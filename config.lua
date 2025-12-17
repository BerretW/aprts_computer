Config = {}
Config.Debug = false

-- Hardwarové komponenty (názvy itemů v inventory)
Config.Hardware = {
    -- CPU: Určuje interval "ticku" na serveru (v sekundách)
    cpu = {
        ['cpu_celeron'] = { label = "Intel Celeron", tickRate = 20 }, -- Pomalý (default)
        ['cpu_i5'] = { label = "Intel Core i5", tickRate = 10 },
        ['cpu_i9'] = { label = "Intel Core i9", tickRate = 5 },      -- Rychlý
    },
    -- GPU: Násobič výdělku/výkonu pro background tasky
    gpu = {
        ['gpu_integrated'] = { label = "Integrated Graphics", multiplier = 0.5 },
        ['gpu_1050'] = { label = "GTX 1050", multiplier = 1.0 },
        ['gpu_3090'] = { label = "RTX 3090", multiplier = 3.0 },
    },
    -- RAM: Maximální počet otevřených oken (aplikací) naráz
    ram = {
        ['ram_4gb'] = { label = "4GB RAM", maxApps = 2 },
        ['ram_8gb'] = { label = "8GB RAM", maxApps = 5 },
        ['ram_32gb'] = { label = "32GB RAM", maxApps = 10 },
    },
    -- HDD: Kapacita v MB (pro soubory a instalované aplikace)
    hdd = {
        ['hdd_250gb'] = { label = "250GB HDD", capacity = 250 },
        ['ssd_1tb'] = { label = "1TB SSD", capacity = 1000 },
    }
}

-- Asociace souborů (Přípona -> Která appka to otevře)
Config.FileExtensions = {
    ['txt'] = 'notepad',
    ['doc'] = 'word_editor', -- Uživatel si musí nainstalovat 'word_editor'
    ['png'] = 'photo_viewer',
    ['min'] = 'miner_app' -- Konfigurační soubor minera
}

-- Defaultní stav nového PC
Config.DefaultSpecs = {
    cpu = 'cpu_celeron',
    gpu = 'gpu_integrated',
    ram = 'ram_4gb',
    hdd = 'hdd_250gb'
}