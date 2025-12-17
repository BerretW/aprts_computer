Core.registerApp("notepad", {
  title: "Poznámkový blok",
  icon: "fas fa-edit",
  iconColor: "#3498db",
  type: "window",
  width: 600,
  height: 400,
  resizable: true,
  templateId: "tpl-notepad",

  // DEFINICE MENU
  menu: [
    {
      label: "Soubor",
      items: [
        { label: "Nový", action: "new", handler: (app) => app.methods.clear() },
        {
          label: "Uložit",
          action: "save",
          shortcut: "Ctrl+S",
          handler: (app) => app.methods.save(),
        },
        {
          label: "Zavřít",
          action: "exit",
          handler: (app) => WindowManager.close(app.pid),
        },
      ],
    },
    {
      label: "Úpravy",
      items: [
        {
          label: "Vymazat vše",
          action: "clear",
          handler: (app) => app.methods.clear(),
        },
      ],
    },
  ],

  onOpen: (app, data) => {
    // Inicializace Quill editoru
    const editorEl = app.content.find("#notepad-editor")[0];
    app.quill = new Quill(editorEl, { theme: "snow" });

    // Pokud jsme otevřeli soubor
    app.currentFile = null;
    if (data && data.content) {
      app.quill.setText(data.content);
      app.currentFile = data;
      app.root
        .find(".window-title")
        .html(`<i class="fas fa-edit"></i> ${data.name}`);
    }

    // Definice metod specifických pro instanci
    app.methods = {
      save: async () => {
        const text = app.quill.getText();
        let fileName = app.currentFile ? app.currentFile.name : "dokument.txt";

        // Pokud je soubor nový, použijeme náš nový PROMPT
        if (!app.currentFile) {
          // Await zastaví vykonávání, dokud uživatel neklikne
          const name = await Core.Modal.prompt(
            "Uložit soubor",
            "Zadejte název souboru:",
            fileName
          );

          // Pokud dal uživatel Zrušit nebo nic nenapsal
          if (!name) return;
          fileName = name;
        }

        $.post(
          "https://aprts_computer/saveFile",
          JSON.stringify({
            pathArray: [],
            fileName: fileName,
            content: text,
            extension: "txt",
          })
        );

        // Použijeme náš ALERT místo Swalu
        Core.Modal.alert("Notepad", "Soubor byl úspěšně uložen.");
      },
      clear: () => {
        app.quill.setText("");
        app.currentFile = null;
      },
    };
  },
});
