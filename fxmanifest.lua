fx_version 'cerulean'
lua54 'yes'
name 'aprts_computer'
description 'Advanced Computer System Core'
author 'SpoiledMouse'
version '2.0.0'

games {'gta5'}

ui_page 'html/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua'
}

files {
    'html/index.html',
    'html/css/style.css',
    'html/libs/*',
    'html/js/core.js',
    'html/js/modules/*.js' -- Načte všechny moduly
}

client_scripts {
    'client/animation.lua',
    'client/main.lua'
}

server_script 'server.lua'

exports {
    'RegisterApp',    -- Registrace ikony do menu
    'OpenWindow',     -- Otevření okna s vlastním HTML
    'GetSystemData'   -- Získání dat o PC (HW, User)
}

dependencies {
    'oxmysql',
    'ox_lib',
    'ox_inventory'
}