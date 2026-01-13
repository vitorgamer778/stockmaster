
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Tab, Unit, AuthState, User, StockEntry } from './types';
// Serverless: use the internal /api/extract endpoint to keep GEMINI_API_KEY on the server
// (previously imported client-side)
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { logEvent, getLogs, exportLogsJSON, exportLogsCSV, clearLogs } from './services/logService';

const MASTER_PHONE = '62998208705';
const MASTER_NAME = 'Victhor Hugo Carvalho Rodrigues';
const MASTER_PASSWORD = '12279154';

const INITIAL_UNITS: Unit[] = [
  { id: 'u1', name: 'Unidade', shortName: 'un' },
  { id: 'u2', name: 'Quilo', shortName: 'kg' },
  { id: 'u3', name: 'Caixa', shortName: 'cx' },
  { id: 'u4', name: 'Pacote', shortName: 'pct' },
  { id: 'u5', name: 'Saco', shortName: 'sc' },
  { id: 'u6', name: 'Litro', shortName: 'lt' },
];

const INITIAL_TABS: Tab[] = [
  { id: 'tab-1', name: 'Geral', instruction: 'Todos os produtos do inventário' },
  { id: 'tab-2', name: 'Alimentos', instruction: 'Arroz, feijão, massas, grãos e comidas em geral' },
  { id: 'tab-3', name: 'Bebidas', instruction: 'Refrigerantes, sucos, cervejas, whiskies e líquidos' },
  { id: 'tab-4', name: 'Higiene & Limpeza', instruction: 'Sabão, detergente, desinfetante, papel higiênico e cuidados pessoais' },
  { id: 'tab-5', name: 'Bazar & Outros', instruction: 'Pilhas, utensílios, carvão e itens diversos' },
];

const App: React.FC = () => {
  // --- Estados do Sistema ---
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, step: 'login', phone: '', role: 'user' });
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('sm_users_list');
    return saved ? JSON.parse(saved) : [{ phone: MASTER_PHONE, password: MASTER_PASSWORD, name: MASTER_NAME, role: 'admin' }];
  });

  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('sm_tabs');
    return saved ? JSON.parse(saved) : INITIAL_TABS;
  });
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('sm_products');
    return saved ? JSON.parse(saved) : [];
  });
  const [units, setUnits] = useState<Unit[]>(() => {
    const saved = localStorage.getItem('sm_units');
    return saved ? JSON.parse(saved) : INITIAL_UNITS;
  });

  // --- Estados de Interface ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Modais
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [isTabEditModalOpen, setIsTabEditModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isExpiryModalOpen, setIsExpiryModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistência ---
  useEffect(() => { localStorage.setItem('sm_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('sm_tabs', JSON.stringify(tabs)); }, [tabs]);
  useEffect(() => { localStorage.setItem('sm_users_list', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('sm_units', JSON.stringify(units)); }, [units]);

  // --- Memos e Helpers ---
  const isAdmin = auth.role === 'admin';
  const currentUser = useMemo(() => users.find(u => u.phone === auth.phone), [users, auth.phone]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesTab = activeTabId === 'tab-1' || p.tabId === activeTabId;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code && p.code.includes(searchTerm));
      return matchesTab && matchesSearch;
    });
  }, [products, activeTabId, searchTerm]);

  const nearExpiryList = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    return products.flatMap(p => p.stocks
      .filter(s => s.expiryDate && new Date(s.expiryDate) <= in30Days)
      .map(s => ({ 
        productName: p.name, quantity: s.quantity, 
        unit: units.find(u => u.id === s.unitId)?.shortName || '', 
        expiry: s.expiryDate 
      }))
    ).sort((a, b) => new Date(a.expiry!).getTime() - new Date(b.expiry!).getTime());
  }, [products, units]);

  const stats = useMemo(() => ({ total: products.length, nearExpiry: nearExpiryList.length }), [products, nearExpiryList]);

  // --- Funções de Ação ---

  const startLoading = (msg: string, duration = 2000) => {
    setIsProcessing(true);
    setLoadingMessage(msg);
    setLoadingProgress(0);
    const step = 100 / (duration / 100);
    let curr = 0;
    const interval = setInterval(() => {
      curr += step;
      if (curr >= 95) clearInterval(interval);
      setLoadingProgress(Math.min(curr, 95));
    }, 100);
    return interval;
  };

  const stopLoading = (interval: any) => {
    clearInterval(interval);
    setLoadingProgress(100);
    setTimeout(() => {
      setIsProcessing(false);
      setLoadingProgress(0);
    }, 400);
  };

  const handleLogout = () => {
    logEvent('logout', null, auth.phone);
    setAuth({ isLoggedIn: false, step: 'login', phone: '', role: 'user' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loader = startLoading("Autenticando...", 800);
    setTimeout(() => {
      const cleanPhone = loginForm.phone.replace(/\D/g, '');
      const found = users.find(u => u.phone === cleanPhone && u.password === loginForm.password);
      stopLoading(loader);
      if (found) {
        logEvent('login_requested', { phone: cleanPhone }, cleanPhone);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtp(otp);
        alert(`CÓDIGO DE ACESSO: ${otp}`);
        setAuth({ ...auth, step: 'otp', phone: cleanPhone, role: found.role });
      } else {
        logEvent('login_failed', { phone: loginForm.phone }, loginForm.phone.replace(/\D/g, ''));
        setLoginError("Credenciais incorretas.");
      }
    }, 800);
  };

  const handleValidateOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput === generatedOtp) {
      logEvent('login_success', null, auth.phone);
      setAuth({...auth, step: 'authenticated', isLoggedIn: true});
    } else {
      logEvent('login_otp_failed', null, auth.phone);
      alert("Código Incorreto!");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const loader = startLoading("IA lendo nota e categorizando abas...", 5000);

    try {
      logEvent('file_upload_started', { filename: file.name, type: file.type }, auth.phone);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];

        // Call serverless endpoint to keep API key secret
        const resp = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mimeType: file.type, tabs: tabs.filter(t => t.id !== 'tab-1') })
        });

        const data = await resp.json();
        if (!resp.ok || !data.ok) {
          const errorMsg = data?.error || 'Erro ao consultar a IA';
          stopLoading(loader);
          logEvent('file_upload_error', { error: errorMsg }, auth.phone);
          return alert(errorMsg);
        }

        const extracted = data.data as { code: string, name: string, categoryName: string }[];

        const newItems: Product[] = extracted.map((item, idx) => {
          const matchedTab = tabs.find(t => t.name.toUpperCase() === item.categoryName.toUpperCase());
          return {
            id: `prod-ia-${Date.now()}-${idx}`,
            code: item.code,
            name: item.name,
            tabId: matchedTab ? matchedTab.id : 'tab-1',
            stocks: [{ quantity: 0, unitId: 'u1', expiryDate: '' }],
            lastCounted: new Date().toISOString()
          };
        });

        setProducts(prev => [...newItems, ...prev]);
        stopLoading(loader);
        logEvent('file_upload_parsed', { count: extracted.length }, auth.phone);
        alert(`${extracted.length} itens importados e divididos nas abas!`);
        setIsSettingsModalOpen(false);
      };
    } catch (err: any) {
      stopLoading(loader);
      logEvent('file_upload_error', { error: err?.message || String(err) }, auth.phone);
      alert(err.message);
    }
  };

  const handleGeneratePDF = async () => {
    logEvent('export_pdf', { count: products.length }, auth.phone);
    const loader = startLoading("Gerando Relatório PDF...", 1500);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(20); doc.setTextColor(79, 70, 229);
      doc.text('ESTOQUE MASTER PRO', pageWidth / 2, 20, { align: 'center' });
      
      const body = products.flatMap(p => 
        p.stocks.map((s, idx) => [
          idx === 0 ? (p.code || '-') : '', 
          idx === 0 ? p.name : '', 
          `${s.quantity} ${units.find(u => u.id === s.unitId)?.shortName}`,
          s.expiryDate || '-',
          idx === 0 ? (tabs.find(t => t.id === p.tabId)?.name || 'Geral') : ''
        ])
      );

      (doc as any).autoTable({
        startY: 35,
        head: [['Cód', 'Produto', 'Qtd', 'Validade', 'Aba']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });

      doc.save(`estoque_${new Date().toLocaleDateString()}.pdf`);
    } finally {
      stopLoading(loader);
    }
  };

  const handleUpdateStock = (productId: string, stockIdx: number, delta: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const ns = [...p.stocks];
      ns[stockIdx].quantity = Math.max(0, ns[stockIdx].quantity + delta);
      const newQty = ns[stockIdx].quantity;
      logEvent('stock_updated', { productId, stockIdx, delta, newQuantity: newQty }, auth.phone);
      return { ...p, stocks: ns, lastCounted: new Date().toISOString() };
    }));
  };

  const handleAddStockLine = (productId: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newStocks = [...p.stocks, { quantity: 0, unitId: units[0]?.id || 'u1', expiryDate: '' }];
      logEvent('stock_line_added', { productId, newSize: newStocks.length }, auth.phone);
      return {
        ...p,
        stocks: newStocks,
        lastCounted: new Date().toISOString()
      };
    }));
  };

  const handleRemoveStockLine = (productId: string, stockIdx: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      if (p.stocks.length <= 1) return p;
      const ns = p.stocks.filter((_, i) => i !== stockIdx);
      logEvent('stock_line_removed', { productId, removedIdx: stockIdx, newSize: ns.length }, auth.phone);
      return { ...p, stocks: ns, lastCounted: new Date().toISOString() };
    }));
  };

  // --- Gestão de Unidades ---
  const handleSaveUnit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('uname') as string;
    const shortName = (formData.get('ushort') as string).toLowerCase();
    
    if (!name || !shortName) return;

    if (editingUnit) {
      setUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, name, shortName } : u));
      logEvent('unit_saved', { name, shortName, editedId: editingUnit.id }, auth.phone);
      setEditingUnit(null);
    } else {
      setUnits(prev => [...prev, { id: `u-${Date.now()}`, name, shortName }]);
      logEvent('unit_saved', { name, shortName, editedId: null }, auth.phone);
    }
    e.currentTarget.reset();
  };

  const handleDeleteUnit = (id: string) => {
    if (units.length <= 1) return alert("Mínimo de 1 unidade necessária.");
    if (confirm("Apagar esta unidade?")) {
      logEvent('unit_deleted', { id }, auth.phone);
      setUnits(prev => prev.filter(u => u.id !== id));
    }
  };

  // --- Gestão de Usuários (Equipe) ---
  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('username') as string;
    const phone = (formData.get('userphone') as string).replace(/\D/g, '');
    const password = formData.get('userpass') as string;

    if (!name || !phone || !password) return;

    if (editingUser) {
      setUsers(prev => prev.map(u => u.phone === editingUser.phone ? { ...u, name, phone, password } : u));
      logEvent('user_saved', { name, phone, editing: editingUser.phone }, auth.phone);
      setEditingUser(null);
    } else {
      if (users.find(u => u.phone === phone)) return alert("Telefone já cadastrado!");
      setUsers(prev => [...prev, { name, phone, password, role: 'user' }]);
      logEvent('user_saved', { name, phone, editing: null }, auth.phone);
    }
    e.currentTarget.reset();
  };

  const handleDeleteUser = (phone: string) => {
    if (phone === MASTER_PHONE) return alert("Não é possível apagar o Master.");
    if (confirm("Remover este membro da equipe?")) {
      logEvent('user_deleted', { phone }, auth.phone);
      setUsers(prev => prev.filter(u => u.phone !== phone));
    }
  };

  // --- Handlers de Criação de Abas ---
  const handleCreateTab = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('tname') as string;
    const instruction = formData.get('tinstruction') as string;
    if (!name) return;
    const newTab = { id: `tab-${Date.now()}`, name, instruction } as Tab;
    setTabs(prev => [...prev, newTab]);
    logEvent('tab_created', { id: newTab.id, name }, auth.phone);
    setIsTabModalOpen(false);
  };

  const handleSetActiveTab = (tabId: string) => {
    setActiveTabId(tabId);
    logEvent('tab_selected', { tabId }, auth.phone);
  };

  const handleEditTab = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTab) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('etname') as string;
    const instruction = formData.get('etinstruction') as string;
    if (!name) return;
    setTabs(prev => prev.map(t => t.id === editingTab.id ? { ...t, name, instruction } : t));
    logEvent('tab_edited', { id: editingTab.id, name }, auth.phone);
    setIsTabEditModalOpen(false);
    setEditingTab(null);
  };

  const handleDeleteTab = (tabId: string, tabName: string) => {
    if (tabId === 'tab-1') {
      alert("A aba Geral é obrigatória e não pode ser excluída.");
      return;
    }
    
    if (confirm(`Atenção: A aba "${tabName}" será excluída.\n\nTodos os produtos desta aba serão movidos para o setor "Geral". Deseja continuar?`)) {
      // Move produtos
      setProducts(products.map(p => p.tabId === tabId ? { ...p, tabId: 'tab-1' } : p));
      // Log and remove aba
      logEvent('tab_deleted', { id: tabId, name: tabName }, auth.phone);
      setTabs(tabs.filter(t => t.id !== tabId));
      // Reset active tab se necessário
      if (activeTabId === tabId) {
        setActiveTabId('tab-1');
      }
      // Fecha modal
      setEditingTab(null);
      setIsTabEditModalOpen(false);
    }
  };

  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('pname') as string || '').toUpperCase();
    const code = (formData.get('pcode') as string || '');
    if (!name) return;
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name,
      code,
      tabId: activeTabId === 'tab-1' ? (tabs[1]?.id || 'tab-2') : activeTabId,
      stocks: [{ quantity: 0, unitId: units[0]?.id || 'u1', expiryDate: '' }],
      lastCounted: new Date().toISOString()
    };
    setProducts(prev => [newProduct, ...prev]);
    logEvent('product_created', { id: newProduct.id, name: newProduct.name, tabId: newProduct.tabId }, auth.phone);
    setIsProductModalOpen(false);
  };

  const handleEditProductName = (productId: string, name: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, name: name.toUpperCase() } : p));
    logEvent('product_edited', { productId, field: 'name', value: name }, auth.phone);
  };

  const handleEditProductCode = (productId: string, code: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, code } : p));
    logEvent('product_edited', { productId, field: 'code', value: code }, auth.phone);
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (confirm("Apagar produto?")) {
      logEvent('product_deleted', { id: prod.id, name: prod.name }, auth.phone);
      setProducts(products.filter(px => px.id !== productId));
    }
  };

  const handleChangeUnit = (productId: string, stockIdx: number, unitId: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const ns = [...p.stocks]; ns[stockIdx].unitId = unitId;
      logEvent('stock_unit_changed', { productId, stockIdx, unitId }, auth.phone);
      return { ...p, stocks: ns, lastCounted: new Date().toISOString() };
    }));
  };

  const handleChangeExpiry = (productId: string, stockIdx: number, expiry: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const ns = [...p.stocks]; ns[stockIdx].expiryDate = expiry;
      logEvent('stock_expiry_changed', { productId, stockIdx, expiry }, auth.phone);
      return { ...p, stocks: ns, lastCounted: new Date().toISOString() };
    }));
  };

  // --- Interface Principal ---

  if (auth.step === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl p-12 animate-scale-in">
           <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl mb-4 shadow-xl">
                <i className="fas fa-boxes-stacked"></i>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">StockMaster</h1>
           </div>
           {loginError && <p className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black mb-4 text-center uppercase tracking-widest">{loginError}</p>}
           <form onSubmit={handleLogin} className="space-y-4">
              <input required placeholder="Telefone" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={loginForm.phone} onChange={e => setLoginForm({...loginForm, phone: e.target.value})} />
              <input required type="password" placeholder="Senha" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">ENTRAR NO SISTEMA</button>
           </form>
        </div>
      </div>
    );
  }

  if (auth.step === 'otp') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[3rem] p-12 text-center animate-scale-in">
           <h2 className="text-xl font-black text-slate-900 uppercase">Verificação</h2>
           <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Insira o código enviado</p>
           <form onSubmit={handleValidateOtp} className="mt-8 space-y-4">
              <input autoFocus maxLength={6} className="w-full text-center text-4xl tracking-widest font-black py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g,''))} />
              <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">VALIDAR ACESSO</button>
              <button type="button" onClick={() => setAuth({...auth, step: 'login'})} className="text-[10px] font-black text-slate-300 uppercase mt-4">Voltar</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {isProcessing && (
        <div className="fixed top-0 left-0 w-full h-1.5 bg-slate-200 z-[1000] overflow-hidden">
          <div className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_10px_indigo]" style={{ width: `${loadingProgress}%` }} />
        </div>
      )}

      <header className="bg-slate-900 text-white p-6 sticky top-0 z-40 shadow-2xl">
         <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-xl"><i className="fas fa-cubes"></i></div>
               <div>
                  <h1 className="text-xl font-black tracking-tighter leading-none uppercase">StockMaster</h1>
                  <p className="text-[8px] font-black text-indigo-400 uppercase">{currentUser?.name}</p>
               </div>
            </div>
            <div className="flex-1 max-w-md relative">
               <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
               <input placeholder="PESQUISAR..." className="w-full pl-12 pr-6 py-3 bg-slate-800 rounded-xl border-none text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
               <button onClick={() => setIsExpiryModalOpen(true)} className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all relative">
                  <i className="fas fa-clock"></i>
                  {stats.nearExpiry > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border-2 border-slate-900">{stats.nearExpiry}</span>}
               </button>
               {isAdmin && <button onClick={() => setIsSettingsModalOpen(true)} className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all"><i className="fas fa-cog"></i></button>}
               <button onClick={handleLogout} className="w-12 h-12 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-power-off"></i></button>
            </div>
         </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8 animate-fade-in">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Itens</p>
                  <h3 className="text-3xl font-black text-indigo-600">{stats.total}</h3>
               </div>
               <i className="fas fa-box text-3xl text-indigo-100"></i>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 flex items-center justify-between">
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Validade Alerta</p>
                  <h3 className="text-3xl font-black text-amber-500">{stats.nearExpiry}</h3>
               </div>
               <i className="fas fa-exclamation-triangle text-3xl text-amber-100"></i>
            </div>
            <div className="md:col-span-2 flex gap-2">
               <button onClick={() => setIsProductModalOpen(true)} className="flex-1 bg-indigo-600 text-white rounded-3xl font-black text-sm uppercase shadow-lg hover:bg-indigo-700 transition-all"><i className="fas fa-plus-circle mr-2"></i> Adicionar Item</button>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white p-1.5 rounded-2xl shadow-md border border-slate-100 overflow-x-auto no-scrollbar max-w-full">
               {tabs.map(tab => (
                 <div key={tab.id} className="relative flex items-center group">
                    <button 
                       onClick={() => handleSetActiveTab(tab.id)}
                       className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTabId === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                       {tab.name}
                    </button>
                    {isAdmin && (
                       <div className="flex gap-1 ml-[-12px] mr-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button onClick={(e) => { e.stopPropagation(); setEditingTab(tab); setIsTabEditModalOpen(true); }} className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[8px] shadow-md hover:bg-indigo-600"><i className="fas fa-pen"></i></button>
                       </div>
                    )}
                 </div>
               ))}
               <button onClick={() => setIsTabModalOpen(true)} className="px-4 text-slate-300 hover:text-indigo-500 transition-colors"><i className="fas fa-plus text-xl"></i></button>
            </div>
         </div>

         <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh] no-scrollbar">
               <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-100">
                     <tr className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                        <th className="p-6">Descrição do Item</th>
                        <th className="p-6">Contagem / Lotes</th>
                        {isAdmin && <th className="p-6 text-right">Ação</th>}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredProducts.map(p => (
                        <tr key={p.id} className="group hover:bg-slate-50/50">
                           <td className="p-6 align-top">
                              <div className="flex flex-col">
                                 <input className="bg-transparent border-none font-black text-slate-800 text-lg p-0 focus:ring-0 uppercase leading-tight" value={p.name} onChange={e => handleEditProductName(p.id, e.target.value)} />
                                 <input className="text-[10px] font-black text-indigo-500 border-none bg-transparent p-0 focus:ring-0 mt-1" value={p.code || ''} placeholder="SKU/CÓDIGO..." onChange={e => handleEditProductCode(p.id, e.target.value)} />
                                 <button onClick={() => handleAddStockLine(p.id)} className="mt-4 text-[9px] font-black text-indigo-600 uppercase flex items-center gap-2">
                                    <i className="fas fa-plus-circle"></i> Novo Lote
                                 </button>
                              </div>
                           </td>
                           <td className="p-6">
                              <div className="space-y-3">
                                 {p.stocks.map((s, idx) => (
                                    <div key={idx} className="flex flex-wrap items-center gap-3 animate-fade-in">
                                       <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                                          <button onClick={() => handleUpdateStock(p.id, idx, -1)} className="w-8 h-8 text-slate-300 hover:text-red-500"><i className="fas fa-minus"></i></button>
                                          <input type="number" className="w-14 text-center font-black text-lg border-none focus:ring-0 bg-transparent" value={s.quantity} onChange={e => handleUpdateStock(p.id, idx, (parseInt(e.target.value) || 0) - s.quantity)} />
                                          <button onClick={() => handleUpdateStock(p.id, idx, 1)} className="w-8 h-8 text-slate-300 hover:text-green-500"><i className="fas fa-plus"></i></button>
                                       </div>
                                       
                                       <select 
                                          className="bg-slate-100 text-[10px] font-black border-none rounded-xl px-4 py-2" 
                                          value={s.unitId} 
                                          onChange={e => handleChangeUnit(p.id, idx, e.target.value)}
                                       >
                                          {units.map(u => <option key={u.id} value={u.id}>{u.shortName.toUpperCase()}</option>)}
                                       </select>

                                       <input 
                                          type="date" 
                                          className="bg-white border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 outline-none" 
                                          value={s.expiryDate || ''} 
                                          onChange={e => handleChangeExpiry(p.id, idx, e.target.value)} 
                                       />

                                       {p.stocks.length > 1 && (
                                          <button onClick={() => handleRemoveStockLine(p.id, idx)} className="text-slate-200 hover:text-red-400 p-2">
                                             <i className="fas fa-times"></i>
                                          </button>
                                       )}
                                    </div>
                                 ))}
                              </div>
                           </td>
                           {isAdmin && (
                              <td className="p-6 text-right align-top">
                                 <button onClick={() => handleDeleteProduct(p.id)} className="text-slate-200 hover:text-red-500 p-3 rounded-full hover:bg-red-50"><i className="fas fa-trash-alt text-xl"></i></button>
                              </td>
                           )}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </main>

      {/* --- MODAIS --- */}

      {isSettingsModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-50/20">
                  <h3 className="font-black text-slate-900 uppercase">Configurações Master</h3>
                  <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="p-8 space-y-4">
                  <button onClick={() => { setIsUnitsModalOpen(true); setIsSettingsModalOpen(false); }} className="w-full flex items-center justify-between p-5 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase">
                     <span className="flex items-center gap-3"><i className="fas fa-balance-scale text-lg"></i> Configurar Unidades de Medida</span>
                     <i className="fas fa-chevron-right"></i>
                  </button>

                  <button onClick={() => { setIsAccessModalOpen(true); setIsSettingsModalOpen(false); }} className="w-full flex items-center justify-between p-5 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase">
                     <span className="flex items-center gap-3"><i className="fas fa-users-cog text-lg text-indigo-500"></i> Gerenciar Equipe</span>
                     <i className="fas fa-chevron-right"></i>
                  </button>

                  <button onClick={() => { setIsLogsModalOpen(true); setIsSettingsModalOpen(false); }} className="w-full flex items-center justify-between p-5 bg-white text-slate-800 rounded-2xl font-black text-[10px] uppercase">
                     <span className="flex items-center gap-3"><i className="fas fa-history text-lg text-indigo-500"></i> Ver Logs de Atividade</span>
                     <i className="fas fa-chevron-right"></i>
                  </button>

                  <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-3xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-all">
                     <i className="fas fa-robot text-4xl text-indigo-400 mb-2"></i>
                     <p className="font-black text-slate-800 text-xs uppercase">Importar via Nota Fiscal (IA)</p>
                     <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                  </div>
                  
                  <button onClick={handleGeneratePDF} className="w-full flex items-center justify-between p-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">
                     <span className="flex items-center gap-3"><i className="fas fa-file-pdf text-red-400"></i> Exportar Inventário PDF</span>
                     <i className="fas fa-download"></i>
                  </button>
               </div>
            </div>
         </div>
      )}

      {isTabEditModalOpen && editingTab && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[110] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-scale-in">
               <h2 className="text-xl font-black text-slate-900 uppercase text-center mb-6">Setor: {editingTab.name}</h2>
               <form onSubmit={handleEditTab} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Nome do Setor</label>
                    <input name="etname" required defaultValue={editingTab.name} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Dica para a IA</label>
                    <textarea name="etinstruction" defaultValue={editingTab.instruction} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold h-24 resize-none" />
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest">
                      SALVAR ALTERAÇÕES
                    </button>
                    
                    {editingTab.id !== 'tab-1' && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteTab(editingTab.id, editingTab.name)} 
                        className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-[10px] tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all"
                      >
                        <i className="fas fa-trash-alt mr-2"></i> EXCLUIR ESTA ABA
                      </button>
                    )}
                    
                    <button type="button" onClick={() => {setIsTabEditModalOpen(false); setEditingTab(null);}} className="w-full text-[9px] font-black text-slate-300 uppercase mt-2 text-center block">
                      Voltar
                    </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {isAccessModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl animate-scale-in">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black text-slate-900 uppercase">Equipe</h2>
                  <button onClick={() => { setIsAccessModalOpen(false); setIsSettingsModalOpen(true); }} className="text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-2xl"></i></button>
               </div>
               <div className="max-h-[35vh] overflow-y-auto space-y-3 mb-8">
                  {users.map(u => (
                     <div key={u.phone} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black">{u.name.charAt(0)}</div>
                           <div>
                              <p className="font-black text-slate-800 text-sm uppercase">{u.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{u.phone}</p>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setEditingUser(u)} className="text-slate-300 hover:text-indigo-500 p-2"><i className="fas fa-pen"></i></button>
                           {u.phone !== MASTER_PHONE && <button onClick={() => handleDeleteUser(u.phone)} className="text-slate-300 hover:text-red-500 p-2"><i className="fas fa-trash"></i></button>}
                        </div>
                     </div>
                  ))}
               </div>
               <form onSubmit={handleSaveUser} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                  <input name="username" required defaultValue={editingUser?.name || ''} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none text-xs" placeholder="Nome" />
                  <input name="userphone" required defaultValue={editingUser?.phone || ''} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none text-xs" placeholder="Telefone" />
                  <input name="userpass" type="password" required defaultValue={editingUser?.password || ''} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none text-xs" placeholder="Senha" />
                  <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase">{editingUser ? 'Salvar' : 'Adicionar'}</button>
                  {editingUser && <button type="button" onClick={() => setEditingUser(null)} className="w-full text-[9px] font-black text-slate-300 uppercase">Cancelar</button>}
               </form>
            </div>
         </div>
      )}

      {isUnitsModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-scale-in">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black text-slate-900 uppercase">Medidas</h2>
                  <button onClick={() => { setIsUnitsModalOpen(false); setIsSettingsModalOpen(true); }} className="text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-2xl"></i></button>
               </div>
               <div className="max-h-[30vh] overflow-y-auto space-y-2 mb-8">
                  {units.map(u => (
                     <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <p className="font-black text-slate-800 text-xs uppercase">{u.name} ({u.shortName})</p>
                        <div className="flex gap-2">
                           <button onClick={() => setEditingUnit(u)} className="text-slate-300 hover:text-indigo-500 p-2"><i className="fas fa-pen"></i></button>
                           <button onClick={() => handleDeleteUnit(u.id)} className="text-slate-300 hover:text-red-500 p-2"><i className="fas fa-trash"></i></button>
                        </div>
                     </div>
                  ))}
               </div>
               <form onSubmit={handleSaveUnit} className="space-y-3">
                  <input name="uname" required defaultValue={editingUnit?.name || ''} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm" placeholder="Nome" />
                  <input name="ushort" required maxLength={3} defaultValue={editingUnit?.shortName || ''} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm" placeholder="Sigla" />
                  <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase">Salvar</button>
               </form>
            </div>
         </div>
      )}

      {isLogsModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-50/10">
                  <h3 className="font-black text-slate-900 uppercase">Logs de Atividade</h3>
                  <div className="flex gap-2">
                    <button onClick={() => exportLogsJSON()} className="py-2 px-3 bg-slate-50 text-slate-700 rounded-xl font-black text-[10px]">Exportar JSON</button>
                    <button onClick={() => exportLogsCSV()} className="py-2 px-3 bg-slate-50 text-slate-700 rounded-xl font-black text-[10px]">Exportar CSV</button>
                    <button onClick={() => { if(confirm('Limpar todos os logs?')) { clearLogs(); logEvent('logs_cleared', null, auth.phone); } }} className="py-2 px-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px]">Limpar</button>
                    <button onClick={() => { setIsLogsModalOpen(false); setIsSettingsModalOpen(true); }} className="text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-2xl"></i></button>
                  </div>
               </div>
               <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                  {getLogs().length > 0 ? getLogs().map(l => (
                    <div key={l.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-black text-slate-600 uppercase">{new Date(l.ts).toLocaleString('pt-BR')}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{l.user || 'anon'}</div>
                      </div>
                      <div className="font-black text-slate-800 text-sm uppercase">{l.event}</div>
                      <pre className="text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">{JSON.stringify(l.payload || {}, null, 2)}</pre>
                    </div>
                  )) : <p className="text-center py-10 font-black text-slate-300 uppercase tracking-widest">Nenhum log registrado ainda.</p>}
               </div>
            </div>
         </div>
      )}

      {isTabModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-scale-in">
               <h2 className="text-xl font-black text-slate-900 uppercase text-center mb-6">Novo Setor</h2>
               <form onSubmit={handleCreateTab} className="space-y-4">
                  <input name="tname" required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold" placeholder="NOME DO SETOR" autoFocus />
                  <textarea name="tinstruction" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold h-24 resize-none" placeholder="O que vai aqui?" />
                  <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg">CRIAR ABA</button>
                  <button type="button" onClick={() => setIsTabModalOpen(false)} className="w-full text-[9px] font-black text-slate-300 uppercase mt-2">Fechar</button>
               </form>
            </div>
         </div>
      )}

      {isExpiryModalOpen && (
         <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-amber-50">
                  <h3 className="font-black text-slate-900 uppercase">Alertas de Validade</h3>
                  <button onClick={() => setIsExpiryModalOpen(false)} className="text-slate-300 hover:text-red-500"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="p-8 max-h-[60vh] overflow-y-auto space-y-3">
                  {nearExpiryList.length > 0 ? nearExpiryList.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                       <div>
                          <p className="font-black text-slate-800 text-sm uppercase">{item.productName}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase">{item.quantity} registrados</p>
                       </div>
                       <div className={`px-4 py-2 rounded-xl font-black text-[10px] ${new Date(item.expiry!) < new Date() ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {new Date(item.expiry!).toLocaleDateString('pt-BR')}
                       </div>
                    </div>
                  )) : <p className="text-center py-10 font-black text-slate-300 uppercase tracking-widest">Estoque em dia!</p>}
               </div>
            </div>
         </div>
      )}

      {isProductModalOpen && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-scale-in">
               <h2 className="text-xl font-black text-slate-900 uppercase text-center mb-8">Novo Item</h2>
               <form onSubmit={handleCreateProduct} className="space-y-4">
                  <input name="pname" required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase" placeholder="NOME DO PRODUTO" autoFocus />
                  <input name="pcode" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold" placeholder="CÓDIGO (OPCIONAL)" />
                  <button className="w-full py-5 bg-indigo-600 text-white rounded-xl font-black shadow-xl">ADICIONAR</button>
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="w-full text-[9px] font-black text-slate-300 uppercase mt-2">Cancelar</button>
               </form>
            </div>
         </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.2, 1, 0.2, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
