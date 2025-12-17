// =============================================================================
// KONTEXTOVÉ MENU (REGISTRACE)
// =============================================================================

// 1. Akce pro SOUBORY
Core.registerContextItem("file", {
  label: "Otevřít",
  icon: "fa-external-link-alt",
  action: (data) => {
    if (data.extension === "txt") Core.openApp("notepad", data);
    else Core.Modal.alert("Info", `Neznámý typ souboru: .${data.extension}`);
  },
});

Core.registerContextItem("file", { separator: true });

Core.registerContextItem("file", {
  label: "Smazat",
  icon: "fa-trash",
  action: async (data) => {
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

// 2. Akce pro SLOŽKY
Core.registerContextItem("folder", {
  label: "Otevřít",
  icon: "fa-folder-open",
  action: (data) => {
    // Logika otevření probíhá přes doubleclick, ale mohla by být i zde
    // (vyžadovalo by přístup k instanci app, což context menu defaultně nemá přímo)
  },
});

Core.registerContextItem("folder", {
  label: "Smazat složku",
  icon: "fa-trash",
  action: async (data) => {
    const confirmed = await Core.Modal.confirm(
      "Smazat složku?",
      `Smazáním složky <b>${data.name}</b> přijdete o všechna data v ní. Pokračovat?`
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

// 3. Akce pro POZADÍ (Background) - Nový soubor/složka
Core.registerContextItem("files-background", {
  label: "Nový textový dokument",
  icon: "fa-file-alt",
  action: async (data) => {
    const name = await Core.Modal.prompt(
      "Nový soubor",
      "Zadejte název souboru:",
      "NovyDokument"
    );
    if (name) {
      $.post(
        "https://aprts_computer/saveFile",
        JSON.stringify({
          pathArray: data.currentPath,
          fileName: name + ".txt",
          content: "",
          extension: "txt",
        })
      );
    }
  },
});

Core.registerContextItem("files-background", {
  label: "Nová složka",
  icon: "fa-folder-plus",
  action: async (data) => {
    const name = await Core.Modal.prompt(
      "Nová složka",
      "Zadejte název složky:",
      "NovaSlozka"
    );
    if (name) {
      $.post(
        "https://aprts_computer/createFolder",
        JSON.stringify({
          pathArray: data.currentPath,
          folderName: name,
        })
      );
    }
  },
});

// =============================================================================
// DEFINICE APLIKACE FILES
// =============================================================================

Core.registerApp("files", {
  title: "Průzkumník",
  icon: "fas fa-folder-open",
  iconColor: "#f1c40f",
  type: "window",
  width: 800,
  height: 500,
  templateId: "tpl-files",

  systemFiles: [], // Zde se ukládají data z LUA

  onOpen: (app) => {
    app.currentPath = [];

    // Bind tlačítek navigace
    app.content.find("#btn-back").click(() => app.methods.goUp());
    app.content.find("#btn-home").click(() => app.methods.goHome());

    // METODY INSTANCE
    app.methods = {
      render: () => {
        // 1. Procházení stromem složek
        let currentFolder = Core.apps["files"].systemFiles;
        app.currentPath.forEach((name) => {
          const f = currentFolder.find(
            (i) => i.name === name && i.type === "folder"
          );
          if (f) currentFolder = f.children;
        });

        const grid = app.content.find("#files-grid");
        grid.empty();
        grid.on("dragover", (e) => {
          e.preventDefault(); // Nutné pro povolení dropu
          e.stopPropagation();
          if (e.originalEvent.dataTransfer) {
            // Nastavíme vizuálně "move", aby uživatel viděl, že stále drží soubor
            e.originalEvent.dataTransfer.dropEffect = "move";
          }
        });
        grid.on("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        // 2. Kontextové menu na pozadí (pro grid)
        grid.off("contextmenu").on("contextmenu", (e) => {
          if (e.target === e.currentTarget || e.target.id === "files-grid") {
            // Předáváme aktuální cestu do akce
            ContextMenu.show(e, "files-background", {
              currentPath: [...app.currentPath],
            });
          }
        });

        // 3. Vykreslení položek
        currentFolder.forEach((item) => {
          const isFolder = item.type === "folder";
          const icon = isFolder ? "fa-folder" : "fa-file-alt";
          const color = isFolder ? "#f1c40f" : "#ecf0f1";

          // HTML Itemu - přidáme draggable
          const el = $(`
                        <div class="file-item" draggable="true">
                            <i class="fas ${icon}" style="color:${color}"></i>
                            <span>${item.name}</span>
                        </div>
                    `);

          // --- EVENTY ---

          // A) Double Click (Otevření)
          el.dblclick(() => {
            if (isFolder) {
              app.currentPath.push(item.name);
              app.methods.render();
            } else {
              if (item.extension === "txt") Core.openApp("notepad", item);
              else if (item.extension === "png")
                Core.Modal.alert("Foto", "Prohlížeč fotek není implementován.");
              else
                Core.Modal.alert("Info", `Soubor ${item.name} nelze otevřít.`);
            }
          });

          // B) Context Menu (Pravé tlačítko)
          el.on("contextmenu", (e) => {
            e.stopPropagation(); // Zamezí otevření menu pozadí
            ContextMenu.show(e, isFolder ? "folder" : "file", item);
          });

          // C) DRAG & DROP LOGIKA

          // Drag Start: Co přenášíme?
// C) DRAG & DROP LOGIKA

          // Drag Start
          el.on("dragstart", (e) => {
            const dt = e.originalEvent.dataTransfer;
            dt.effectAllowed = "move";
            
            dt.setData(
              "text/plain",
              JSON.stringify({
                name: item.name,
                type: item.type,
              })
            );

            // Pro jistotu explicitně nastavíme obrázek dragu (pokud by zlobil)
            if (dt.setDragImage) {
                 dt.setDragImage(el[0], 0, 0);
            }

            // Přidáme styl se zpožděním, aby si prohlížeč stihl vyfotit "ducha"
            setTimeout(() => {
                el.addClass('dragging');
            }, 0);
          });

          // Drag End
          el.on("dragend", (e) => {
              el.removeClass('dragging');
          });

          // --- UNIVERZÁLNÍ DRAGOVER (PRO VŠECHNY POLOŽKY) ---
          // Toto zajistí, že se neukáže zakazující ikona, když jedeme nad jiným souborem
          el.on("dragover", (e) => {
              e.preventDefault(); 
              e.stopPropagation();
              // Povolíme vizuální efekt přesunu všude
              if(e.originalEvent.dataTransfer) {
                  e.originalEvent.dataTransfer.dropEffect = "move";
              }
          });

          // Drop Zone (Pouze pokud je cíl SLOŽKA)
          if (isFolder) {
            // Drag Enter/Over vizuál pro složku
            el.on("dragenter", () => el.addClass("drag-over"));
            el.on("dragleave", () => el.removeClass("drag-over"));

            // Drop: Zpracujeme přesun
            el.on("drop", (e) => {
              e.preventDefault();
              e.stopPropagation();
              el.removeClass("drag-over");

              const rawData = e.originalEvent.dataTransfer.getData("text/plain");
              if (!rawData) return;

              const draggedItem = JSON.parse(rawData);

              // Validace
              if (draggedItem.name === item.name) return;

              // Cílová cesta
              const targetPath = [...app.currentPath, item.name];

              // Odeslání
              $.post(
                "https://aprts_computer/fileOperation",
                JSON.stringify({
                  action: "move",
                  fileName: draggedItem.name,
                  targetPath: targetPath,
                })
              );
            });
          }

          grid.append(el);
        });

        // Aktualizace UI (breadcrumbs, status bar)
        app.content.find("#path-input").val("C:/" + app.currentPath.join("/"));
        app.content
          .find("#files-status")
          .text(`Položek: ${currentFolder.length}`);
      },

      // Navigace Zpět
      goUp: () => {
        if (app.currentPath.length > 0) {
          app.currentPath.pop();
          app.methods.render();
        }
      },

      // Navigace Domů (Root)
      goHome: () => {
        app.currentPath = [];
        app.methods.render();
      },
    };

    // První render při otevření
    app.methods.render();
    // Nastavení refresh funkce pro Core (aby server mohl refreshnout okno)
    app.refresh = app.methods.render;
  },
});
