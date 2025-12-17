### 🟢 Fáze 1: Hardware a Výkon (Backend)

**Toto je srdce celého systému. Bez toho je to jen "hezké UI".**

[ ]

**Definice Itemů v Inventory:**

* **Vytvořit itemy v** **ox_inventory/data/items.lua** **(např.** **cpu_i5**, **ram_8gb**, **gpu_3090**, **hdd_ssd**).
* **Nastavit jim metadata nebo popisky.**

[ ]

**Logika Upgradu (Server-side):**

* **Dokončit event** **aprts_computer:server:upgradeComponent**.
* **Musí odebrat item z inventáře, aktualizovat JSON v SQL a přepočítat statistiky běžícího PC (**ActivePCs**).**
* **Implementovat logiku pro HDD: Pokud hráč downgraduje disk na menší kapacitu, než je velikost dat, upgrade musí selhat.**

[ ]

**CPU Tick System:**

* **V** **server.lua** **je smyčka** **CreateThread**. Je třeba ji napojit na reálnou logiku.
* **CPU by mělo ovlivňovat, jak často se spustí funkce** **ProcessPCTick** **(např. i9 = každých 5s, Celeron = každých 20s).**

[ ]

**GPU Mining Logic:**

* **Vytvořit backend logiku pro Crypto Miner.**
* **Vzorec:** **Zisk = (Základ * GPU_Multiplier)**.
* **Musí to běžet, i když je UI zavřené (pokud je PC zapnuté).**

### 🟠 Fáze 2: Souborový systém (Filesystem)

**Aktuálně je to jen "plochý seznam". Potřebujeme stromovou strukturu.**

[ ]

**Složky a Adresáře (Recursion):**

* **Předělat strukturu JSONu z** **[file1, file2]** **na** **[{name: "Složka", type: "folder", children: [...]}]**.
* **Upravit JS (**Files.render**), aby uměl "vstoupit" do složky (změnit** **currentPath**).
* **Upravit breadcrumbs navigaci (C:/Users/Admin/...).**

[ ]

**Context Menu (Pravé tlačítko):**

* **Přidat do JS menu pro soubory:** **Smazat, Přejmenovat, Vlastnosti**.
* **Přidat možnost** **Nová složka**.

[ ]

**Obrázky:**

* **Vylepšit** **Photo Viewer**.
* **Umožnit "uložit" obrázek zadáním URL (protože v GTA nemůžeme snadno uploadovat lokální soubory).**

### 🟡 Fáze 3: Aplikace a Data Types

**Rozšíření funkcionality o "Excel" a další specifické typy.**

[ ]

**Crypto Miner App (UI):**

* **Vytvořit HTML/JS šablonu pro Miner.**
* **Musí zobrazovat graf (Chart.js), aktuální Hashrate (podle GPU) a tlačítko Start/Stop.**
* **Start tlačítko pošle na server flag** **isRunning = true**.

[ ]

**Spreadsheet App (Excel):**

* **Vytvořit šablonu** **tpl-excel**.
* **Implementovat jednoduchou tabulku (např. knihovna** **JExcel** **nebo prostá HTML** **`<table>`** **s** **contenteditable**).
* **Ukládání do souboru s příponou** **.xlsx** **(jako JSON data buněk).**

[ ]

**Browser (Dark Market):**

* **Vytvořit jednoduchou simulaci prohlížeče (iframe nelze použít na externí weby ve hře snadno, takže spíše fiktivní HTML stránky uvnitř resourcu).**
* **Obchod pro nákup nelegálních věcí (napojení na USB klíčenky).**

### 🔵 Fáze 4: Uživatelé a Zabezpečení

**Aby to fungovalo jako reálný OS.**

[ ]

**Správa uživatelů:**

* **Přidat do** **Nastavení** **sekci "Uživatelé".**
* **Tlačítko "Vytvořit účet" (Jméno, Heslo, Je Admin?).**
* **Ukládání do pole** **users** **v SQL JSONu.**

[ ]

**Permise:**

* **Admin (majitel PC) může mazat ostatní uživatele.**
* **Guest nemůže instalovat aplikace nebo měnit HW nastavení.**

[ ]

**Změna hesla:**

* **Funkčnost pro změnu hesla aktuálně přihlášeného uživatele.**

### 🟣 Fáze 5: Polish & Fixes (Doladění)

[ ]

**Notifikace:**

* **Přidat systémové bubliny (Toast notifications) vpravo dole (např. "USB Zařízení připojeno", "Mining dokončen").**

[ ]

**Zvuky:**

* **Přidat zvuky klikání, errorů, startu systému a vypnutí.**

[ ]

**Persistence oken:**

* **(Volitelné/Hard) Aby si PC pamatovalo otevřená okna i po zavření/otevření UI (ne po restartu serveru).**

---

### Doporučený postup (Co dělat teď?)

  **Začni** **Fází 2 (Filesystem - Složky)**, protože to ovlivní, jak se ukládají data pro Excel a Word. Pak přejdi na **Fází 1 (Hardware)**, aby dávaly smysl limity a mining.
