

/* On <body>, so no transformed ancestor makes position:fixed relative to it. */
function ioPanel(){ return document.getElementById('ioOv'); }
function ioClose(){
  var ov = ioPanel();
  if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
}
window.ioClose = ioClose;

/* Read on every open: a saga added since load must be offered. */
function ioSagas(){
  var out = [];
  try{
    var list = (typeof window.edSagas === 'function') ? window.edSagas() : [];
    (list || []).forEach(function(s){
      if(s && s.id) out.push({id:String(s.id), name:String(s.name || s.id)});
    });
  }catch(_){ }
  return out;
}
function ioSagaOptions(allLabel){
  return "<option value=''>" + e(allLabel) + "</option>"
    + ioSagas().map(function(s){
        return "<option value='" + e(s.id) + "'>" + e(s.name) + "</option>";
      }).join('');
}

/* The hint is the row's warning before an irreversible step, the one kind of hint allowed (HANDOFF §12.1 E). */
function ioRow(title, hint, control){
  return "<div class='io-row'>"
    + "<div class='io-rowhead'><b>" + title + "</b></div>"
    + (hint ? "<div class='io-hint'>" + hint + "</div>" : '')
    + "<div class='io-ctl'>" + control + "</div>"
    + "</div>";
}

function ioShell(kind, title, body){
  var ov = ioPanel();
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'ioOv'; ov.className = 'td-ov io-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) ioClose(); });
  }
  ov.innerHTML = "<div class='ed2-modal io-modal io-" + kind + "'>"
    + "<div class='ed2-modal-head wh'>" + (title ? "<b class='wh-t'>" + title + "</b>" : '')
      + "<span class='sg-head-gap'></span>"
      + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='ioClose()'>Close &#10005;</button></div>"
    + "<div class='ed2-modal-body io-body'>" + body + "</div></div>";
  return ov;
}

window.ioOpenExport = function(){
  var n = (window.CARDS || []).length;
  ioShell('export', 'Export',
      ioRow('Spreadsheet (.xlsx)',
        'The ' + 16 + ' columns of the printed card, readable in Excel and '
        + 'anything else. <b>Carries the card, not the card face</b> — no split '
        + 'sections, no Choice line, no orbs, no art or framing, no watermark or '
        + 'highlight.',
        "<label class='io-pick'><span>Sagas</span>"
        + "<select id='ioExSaga'>" + ioSagaOptions('Every card (' + n + ')') + "</select>"
        + "</label>"
        + "<button class='ed2-btn primary' onclick='ioExportSheet()'>Export spreadsheet</button>")
    + ioRow('Full Backup (.zip)',
        '<b>Complete</b> is everything: every card, saga, watermark, saved look '
        + 'and setting, and every picture stored inside the app, written straight '
        + 'to a file you choose - at any size. <b>Cards only</b> is the same '
        + 'without the pictures, a few MB. The <b>art/</b> folder beside the app '
        + 'is separate: keep a copy of it with the zip.',
        "<button class='ed2-btn primary' onclick='edExportBackupZip()'"
        + " title='Every card and every picture the app holds. Large - it is saved"
        + " straight to disk, never held in memory'>"
        + "Complete backup</button>"
        + "<button class='ed2-btn' onclick='edExportBackupData()'>"
        + "Cards only</button>")
    + ioRow('Template Pack (.zip)',
        'Frame templates only — no cards. For moving a look between machines.',
        "<button class='ed2-btn' onclick='edTplExport()'>Export templates</button>")
  );
};

window.ioOpenImport = function(){
  ioShell('import', 'Import',
      ioRow('Spreadsheet (.xlsx)',
        'Rows that match a card by name <b>overwrite</b> it, and you are told how '
        + 'many before anything is written. A column the file does not have is '
        + 'left alone rather than blanked, so a partial sheet cannot strip what '
        + 'it says nothing about.',
        "<label class='io-pick'><span>Put Rows In</span>"
        + "<select id='ioImSaga'>"
          + "<option value=''>Each row’s own Saga column</option>"
          + ioSagas().map(function(s){
              return "<option value='" + e(s.id) + "'>" + e(s.name) + "</option>";
            }).join('')
        + "</select></label>"
        + "<label class='ed2-btn primary io-file'>Choose a spreadsheet…"
        + "<input type='file' accept='.xlsx,.csv' hidden onchange='ioImportSheet(this)'>"
        + "</label>")
    + ioRow('Full Backup (.zip)',
        uiIco('warn') + ' <b>A restore REPLACES.</b> Every card now in the catalogue is '
        + 'cleared first and the file’s cards are written in their place. '
        + 'Every other import on this page merges.',
        "<label class='ed2-btn warn io-file'>Restore a backup…"
        + "<input type='file' accept='.zip' hidden onchange='edRestoreBackupZip(this)'>"
        + "</label>")
    + ioRow('Template Pack (.zip)',
        'Frame templates only. Merges into the templates you already have.',
        "<label class='ed2-btn io-file'>Choose a pack…"
        + "<input type='file' accept='.zip,application/zip' hidden onchange='edTplImport(this)'>"
        + "</label>")
    + "<div class='io-danger'>"
      + ioRow(REBIRTH ? 'Start Again from the Built-In Cards' : 'Start Again from the Official Set',
          'Throws away everything in this catalogue and reinstalls '
          + (REBIRTH ? 'the cards the app shipped with' : 'the official set')
          + '. <b>Take a backup first</b> — you will be asked '
          + 'to type a phrase to confirm.',
          "<button class='ed2-btn warn' onclick='edRestoreCatalog()'>"
          + (REBIRTH ? 'Restore built-in catalog…' : 'Reset to the official set…') + "</button>")
    + "</div>"
  );
};

/* Read the picker before ioClose(): closing removes the panel and its select. */
window.ioExportSheet = function(){
  var sel = document.getElementById('ioExSaga');
  var sid = sel ? sel.value : '';
  ioClose();
  if(sid && typeof window.edSagaExportSheet === 'function'){
    window.edSagaExportSheet(sid);
    return;
  }
  if(typeof window.edExportXlsx === 'function') window.edExportXlsx();
};
window.ioImportSheet = function(input){
  var sel = document.getElementById('ioImSaga');
  var sid = sel ? sel.value : '';
  ioClose();
  if(sid && typeof window.edSagaImportSheetInto === 'function'){
    window.edSagaImportSheetInto(input, sid);
    return;
  }
  if(typeof window.edImportCatalogSheet === 'function')
    window.edImportCatalogSheet(input);
};
