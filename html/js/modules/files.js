// 1. Registrace výchozích akcí pro soubory a složky do Context Menu
Core.registerContextItem("file", {
  label: "Otevřít",
  icon: "fa-external-link-alt",
  action: (data) => {
    if (data.extension === "txt") Core.openApp("notepad", data);
    else Swal.fire("Info", "Neznámý typ souboru", "info");
  },
});

Core.registerContextItem("file", { separator: true });

Core.registerContextItem("file", {
  label: "Smazat",
  icon: "fa-trash",
  action: async (data) => {
    // Použijeme náš CONFIRM (vrací true/false)
    const confirmed = await Core.Modal.confirm(
      "Smazat soubor?",
      `Opravdu chcete trvale smazat soubor <b>${data.name}</b>?`
    );

    if (confirmed) {
      $.post(
        "https://aprts_computer/fileOperation",
        JSON.stringify({
          action: "delete",
          fileName: data.name,
        })
      );
    }
  },
});

Core.registerContextItem("folder", {
  label: "Otevřít",
  icon: "fa-folder-open",
  action: (data) => {
    /* Logika pro otevření složky by byla složitější z vnějšku, řešíme doubleclickem */
  },
});

// 2. Registrace samotné aplikace
Core.registerApp("files", {
  title: "Průzkumník",
  icon: "fas fa-folder-open",
  iconColor: "#f1c40f",
  type: "window",
  width: 800,
  height: 500,
  templateId: "tpl-files",

  systemFiles: [],

  onOpen: (app) => {
    app.currentPath = [];

    app.content.find("#btn-back").click(() => app.methods.goUp());
    app.content.find("#btn-home").click(() => app.methods.goHome());

    app.methods = {
      render: () => {
        let currentFolder = Core.apps["files"].systemFiles;
        app.currentPath.forEach((name) => {
          const f = currentFolder.find(
            (i) => i.name === name && i.type === "folder"
          );
          if (f) currentFolder = f.children;
        });

        const grid = app.content.find("#files-grid");
        grid.empty();

        currentFolder.forEach((item) => {
          const isFolder = item.type === "folder";
          const icon = isFolder ? "fa-folder" : "fa-file-alt";
          const color = isFolder ? "#f1c40f" : "#ecf0f1";

          const el = $(`
                        <div class="file-item">
                            <i class="fas ${icon}" style="color:${color}"></i>
                            <span>${item.name}</span>
                        </div>
                    `);

          // Double click
          el.dblclick(() => {
            if (isFolder) {
              app.currentPath.push(item.name);
              app.methods.render();
            } else {
              if (item.extension === "txt") Core.openApp("notepad", item);
            }
          });

          // === CONTEXT MENU TRIGGER ===
          el.on("contextmenu", (e) => {
            // Zavoláme Core API a předáme typ ('file' nebo 'folder') a data o souboru
            ContextMenu.show(e, isFolder ? "folder" : "file", item);
          });

          grid.append(el);
        });

        app.content.find("#path-input").val("C:/" + app.currentPath.join("/"));
        app.content
          .find("#files-status")
          .text(`Položek: ${currentFolder.length}`);
      },
      goUp: () => {
        app.currentPath.pop();
        app.methods.render();
      },
      goHome: () => {
        app.currentPath = [];
        app.methods.render();
      },
    };

    app.methods.render();
    app.refresh = app.methods.render;
  },
});
