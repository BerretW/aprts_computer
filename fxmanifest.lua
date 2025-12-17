fx_version 'cerulean'
lua54 'yes'
name 'aprts_computer'
description 'Desktop PC and Laptop System'
author 'SpoiledMouse'
version '1.0.0'

games {'gta5'}

ui_page 'html/index.html'

shared_script '@ox_lib/init.lua'
shared_script 'config.lua'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/libs/*' 
}

client_scripts {
    'client/animation.lua',
    'client/main.lua'
}

server_script 'server.lua'

exports {
    'RegisterApp',
    'RegisterUsbApp' -- Nový export pro USB
}