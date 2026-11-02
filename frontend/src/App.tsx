export default function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 select-none">
      {/* Header Corporativo FarmaCore */}
      <header className="bg-emerald-700 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-white text-emerald-700 font-extrabold px-2.5 py-1 rounded text-xl shadow-sm tracking-tight">
            FC
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">FarmaCore ERP</h1>
            <p className="text-xs text-emerald-100 font-medium">Terminal de Balcão • Atendimento Ágil</p>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center bg-emerald-800/80 px-2.5 py-1.5 rounded border border-emerald-600/40 shadow-sm">
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-semibold mr-1.5 shadow-inner">
              F2
            </kbd>
            <span>Buscar Produto</span>
          </div>

          <div className="flex items-center bg-emerald-800/80 px-2.5 py-1.5 rounded border border-emerald-600/40 shadow-sm">
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-semibold mr-1.5 shadow-inner">
              F4
            </kbd>
            <span>Finalizar Pré-Venda</span>
          </div>

          <div className="flex items-center bg-emerald-800/80 px-2.5 py-1.5 rounded border border-emerald-600/40 shadow-sm">
            <kbd className="bg-emerald-950 text-white px-1.5 py-0.5 rounded font-mono font-semibold mr-1.5 shadow-inner">
              Esc
            </kbd>
            <span>Fechar Janela</span>
          </div>
        </div>
      </header>

      {/* Área de Trabalho */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-slate-400">
          <p className="text-base font-medium">Sistema pronto para atendimento.</p>
          <p className="text-sm mt-1">Pressione <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-600 font-mono text-xs">F2</kbd> para iniciar a busca de medicamentos.</p>
        </div>
      </main>
    </div>
  );
}
