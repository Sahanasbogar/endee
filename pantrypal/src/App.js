import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { jsPDF } from 'jspdf';
import {
    LayoutDashboard, Package, PlusCircle, ShoppingCart,
    Bell, User, LogOut, Search, Camera, CheckCircle2,
    AlertTriangle, History, TrendingDown, Info, Trash2, ShieldCheck, Zap,
    Smartphone, ChevronLeft, Check, XCircle, AlertCircle,
    ChefHat, Leaf, ArrowLeft, Wand2, Monitor,
    Percent, Flame, Lightbulb, Box, Minus, Plus, Pencil,
    ArrowRight, RefreshCw, ScanLine, Download, FileText,
    Ticket, Home, ChevronRight, Store, UserCircle2, SlidersHorizontal, BarChart3, MessageSquare, Bot, Mic
} from 'lucide-react';
import SimpleScanner from './SimpleScanner';
import Barcode from 'react-barcode';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// Global Theme Context
const ThemeContext = createContext({ mode: 'system', toggleMode: () => { } });

const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]).filter(k => !['_id', '__v'].includes(k));
    const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
};

const formatPrice = (n) => `₹${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const expiryColor = (item) => {
    const s = item?.expiryStatus || (item?.finalDiscount > 0 ? 'near' : 'fresh');
    if (s === 'urgent') return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-500' };
    if (s === 'near') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-500' };
    return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-500' };
};

// --- LOGIN NOTIFICATION TOAST ---
const LoginNotification = ({ items, userRole, onDismiss }) => {
    const playAlert = () => {
        const roleGreeting = userRole === 'RETAILER' ? 'Retailer' : 'Customer';
        const msgText = `Hello ${roleGreeting}. Attention: You have ${items.length} items near expiry. Please review them soon.`;
        const msg = new SpeechSynthesisUtterance(msgText);
        msg.rate = 1;
        window.speechSynthesis.speak(msg);
    };

    useEffect(() => {
        // Try autoplaying on mount (might be blocked by browser)
        if (!sessionStorage.getItem('pantryVoicePlayed')) {
            playAlert();
            sessionStorage.setItem('pantryVoicePlayed', 'true');
        }
    }, [items.length, userRole]);

    if (!items || items.length === 0) return null;
    return (
        <div className="fixed top-4 left-4 right-4 max-w-md mx-auto z-[100] animate-[slideDown_0.4s_ease-out]">
            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-2xl p-4 shadow-xl flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-900">Near expiry alert</p>
                    <p className="text-sm text-amber-800 mt-0.5">{items.length} item(s) need attention soon</p>
                    <button onClick={playAlert} className="mt-2 text-xs bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-amber-300 font-bold transition-colors">
                        <Mic className="w-3 h-3" /> Play Voice Alert
                    </button>
                </div>
                <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700"><XCircle className="w-5 h-5" /></button>
            </div>
        </div>
    );
};

// Use env var in production, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// --- API HELPER ---
const fetcher = async (url, options = {}) => {
    const token = localStorage.getItem('pantry_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000); // Increased timeout for AI responses

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers, signal: controller.signal });
        clearTimeout(id);
        const data = await response.json();
        return data;
    } catch (err) {
        console.warn("Offline/Demo Mode Active");
        return { error: true };
    }
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Normalize phone to last 10 digits (for display)
const normalizePhone10 = (phone) => {
    if (phone === undefined || phone === null) return '';
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

// --- COMPONENTS ---
const Button = ({ children, onClick, variant = "primary", className = "", loading = false }) => {
    const base = "px-6 py-4 rounded-2xl font-bold transition-all duration-300 ease-out flex items-center justify-center gap-2 active:scale-95 hover:scale-[1.02] shadow-lg shadow-emerald-900/5";
    const variants = {
        primary: "bg-[#1B5E20] text-white hover:bg-[#154a19]",
        secondary: "bg-emerald-50 text-[#1B5E20] hover:bg-emerald-100",
        outline: "border-2 border-slate-200 text-slate-600 hover:border-[#1B5E20] hover:text-[#1B5E20] bg-white",
    };
    return (
        <button onClick={onClick} disabled={loading} className={`${base} ${variants[variant]} ${className}`}>
            {loading && <RefreshCw className="w-5 h-5 animate-spin" />} {children}
        </button>
    );
};

const Input = ({ label, icon: Icon, ...props }) => (
    <div className="space-y-1.5 w-full">
        {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{label}</label>}
        <div className="relative group">
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />}
            <input {...props} className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-4 font-medium outline-none focus:border-[#1B5E20] dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-[#001D3D] dark:text-white`} />
        </div>
    </div>
);

// --- REAL BARCODE SCANNER (reads barcodes from camera only, no photos) ---
const ScannerOverlay = ({ onScan }) => {
    const videoRef = useRef(null);
    const [error, setError] = useState('');
    const lastScanned = useRef(null);

    useEffect(() => {
        let reader = null;
        const onScanRef = onScan;

        const run = async () => {
            try {
                const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');
                const hints = new Map();
                // Focus on common retail barcode formats to reduce mis-reads
                hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                    BarcodeFormat.EAN_13,
                    BarcodeFormat.EAN_8,
                    BarcodeFormat.UPC_A,
                    BarcodeFormat.CODE_128,
                ]);
                reader = new BrowserMultiFormatReader(hints);
                const devices = await reader.getVideoInputDevices();
                const deviceId = devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;

                if (!videoRef.current) return;

                await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
                    if (result && result.getText()) {
                        const code = String(result.getText()).trim();
                        if (code && code !== lastScanned.current) {
                            lastScanned.current = code;
                            try { reader?.reset(); } catch (_) { }
                            onScanRef(code);
                        }
                    }
                });
            } catch (e) {
                console.warn('Barcode scanner:', e);
                setError('Camera needed. Enter barcode manually below.');
            }
        };

        run();
        return () => { try { reader?.reset(); } catch (_) { } if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop()); };
    }, [onScan]);

    return (
        <div className="space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-slate-800 shadow-2xl aspect-[4/3] max-h-72">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70 pointer-events-none" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-52 h-28 border-2 border-emerald-400/90 rounded-xl flex items-center justify-center overflow-hidden bg-black/20">
                        <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.9)] animate-[scanline_1.8s_ease-in-out_infinite]" />
                    </div>
                    <p className="mt-4 text-white font-medium text-sm tracking-wider">Point camera at barcode</p>
                </div>
                <style>{`@keyframes scanline { 0%,100% { transform: translateY(-80px); opacity: 0.5; } 50% { transform: translateY(80px); opacity: 1; } }`}</style>
            </div>
            {error && <p className="text-amber-600 text-sm text-center font-medium">{error}</p>}
        </div>
    );
};

// --- AUTH PAGE ---
const AuthPage = ({ onAuthSuccess }) => {
    const [view, setView] = useState('LANDING');
    const [role, setRole] = useState('RETAILER');
    const [authMode, setAuthMode] = useState('LOGIN');
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');

    const bypassLogin = (demoRole) => {
        const demoUser = { name: "Demo User", phone: "0000000000", role: demoRole };
        localStorage.setItem('pantry_token', 'demo-token');
        localStorage.setItem('pantry_user', JSON.stringify(demoUser));
        onAuthSuccess(demoUser);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const endpoint = authMode === 'LOGIN' ? '/auth/login' : '/auth/register';
            const body = authMode === 'LOGIN' ? { phone, password } : { name, phone, password, role, email };

            const data = await fetcher(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (data.token) {
                localStorage.setItem('pantry_token', data.token);
                localStorage.setItem('pantry_user', JSON.stringify(data.user));
                onAuthSuccess(data.user);
            } else if (data.message === "User Created") {
                setAuthMode('LOGIN');
                alert("Account Created! Please Login.");
            } else {
                alert(data.message || "Operation Failed");
            }
        } catch (e) {
            bypassLogin(role);
        }
        setLoading(false);
    };

    if (view === 'LANDING') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex flex-col items-center justify-center p-6 relative">
                <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50 border border-white/80 relative z-10 animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-10">
                        <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-[#1B5E20] shadow-inner"><Leaf className="w-12 h-12 fill-current" /></div>
                        <h1 className="text-4xl font-black text-[#001D3D] tracking-tighter mb-2">PantryPal+</h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Select your role to continue</p>
                    </div>
                    <div className="space-y-4">
                        <button onClick={() => { setRole('RETAILER'); setView('FORM'); }} className="w-full bg-[#001D3D] text-white p-6 rounded-3xl flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-xl hover:shadow-2xl">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Store className="w-6 h-6" /></div>
                            <div className="text-left flex-1"><h3 className="font-bold text-lg leading-tight">Retailer App</h3><p className="text-white/60 text-xs font-medium">Manage Stock & Sales</p></div><ChevronRight className="w-5 h-5 text-white/40" />
                        </button>
                        <button onClick={() => { setRole('CUSTOMER'); setView('FORM'); }} className="w-full bg-[#1B5E20] text-white p-6 rounded-3xl flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-xl shadow-emerald-900/20 hover:shadow-2xl">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><UserCircle2 className="w-6 h-6" /></div>
                            <div className="text-left flex-1"><h3 className="font-bold text-lg leading-tight">Customer App</h3><p className="text-white/60 text-xs font-medium">Recipes & Alerts</p></div><ChevronRight className="w-5 h-5 text-white/40" />
                        </button>
                    </div>
                    <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-300 uppercase mb-4">Quick Demo Bypass</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => bypassLogin('RETAILER')} className="py-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-500 hover:bg-[#001D3D] hover:text-white transition-colors">Retailer Demo</button>
                            <button onClick={() => bypassLogin('CUSTOMER')} className="py-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-500 hover:bg-[#1B5E20] hover:text-white transition-colors">Customer Demo</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl border border-white relative animate-in slide-in-from-right-8 duration-500">
                <button onClick={() => setView('LANDING')} className="absolute top-8 left-8 p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <div className="text-center mb-8 mt-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg ${role === 'RETAILER' ? 'bg-[#001D3D]' : 'bg-[#1B5E20]'}`}>{role === 'RETAILER' ? <Store /> : <UserCircle2 />}</div>
                    <h1 className="text-2xl font-black text-[#001D3D]">{authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] mt-1">{role} Portal</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {authMode === 'REGISTER' && (
                        <>
                            <Input label="Full Name" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} icon={User} required />
                            <Input label="Email (for notifications)" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </>
                    )}
                    <Input label="Phone Number" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} icon={Smartphone} required />
                    <Input label="Password" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} icon={ShieldCheck} required />
                    <Button type="submit" className={`w-full ${role === 'RETAILER' ? 'bg-[#001D3D]' : 'bg-[#1B5E20]'}`} loading={loading}>{authMode === 'LOGIN' ? 'Login' : 'Create Account'}</Button>
                </form>
                <button onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="w-full text-center mt-6 text-slate-400 font-bold text-sm hover:text-[#1B5E20]">{authMode === 'LOGIN' ? "New here? Create Account" : "Have an account? Login"}</button>
            </div>
        </div>
    );
};


// --- RETAILER COMPONENTS ---
const RetailerDashboard = ({ inventory, user, onNavigate, salesToday }) => {
    const data = Array.isArray(inventory) ? inventory : [];
    const nearExpiryCount = data.filter(i => i.finalDiscount > 0 || i.expiryStatus === 'near' || i.expiryStatus === 'urgent').length;

    // Analytics Data Prep
    const categoryDataMap = data.reduce((acc, item) => {
        const cat = item.category || 'General';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});
    const categoryChartData = Object.keys(categoryDataMap).map(key => ({
        name: key.length > 20 ? key.substring(0, 20) + '...' : key,
        fullName: key,
        value: categoryDataMap[key]
    })).sort((a, b) => b.value - a.value);
    const COLORS = ['#1B5E20', '#34D399', '#F59E0B', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#D946EF', '#14B8A6', '#F43F5E'];

    // Mock weekly trend data (since historical trends require a larger backend change, we use a simple visual representation of inventory health)
    const trendData = [
        { day: 'Mon', stock: Math.max(0, data.length - 15) },
        { day: 'Tue', stock: Math.max(0, data.length - 10) },
        { day: 'Wed', stock: Math.max(0, data.length - 5) },
        { day: 'Thu', stock: data.length },
        { day: 'Fri', stock: data.length + 2 },
        { day: 'Sat', stock: data.length + 8 },
        { day: 'Sun', stock: data.length + 5 },
    ];
    return (
        <div className="animate-in fade-in pb-24 relative">
            
            <div className="flex justify-between items-start mb-8 animate-in slide-up duration-500">
                <div><h1 className="text-3xl font-black text-[#001D3D] dark:text-slate-100 mb-1">Hello, {user.name || 'Retailer'}! 👋</h1><p className="text-slate-400 font-medium">Store Overview</p></div>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(data, 'Inventory_Report')} className="bg-slate-100 dark:bg-slate-800 text-[#001D3D] dark:text-slate-200 p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm" title="Export Dashboard Data"><Download className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                <StatCard title="Total Products" value={data.length} icon={Package} color="text-[#1B5E20]" />
                <StatCard title="Near Expiry" value={nearExpiryCount} icon={AlertTriangle} color="text-amber-500" sub="Sell First" />
                <StatCard title="Sales Today" value={formatPrice(salesToday ?? 0)} icon={ShoppingCart} color="text-blue-500" />
            </div>

            {/* Analytics Section */}
            {data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                    {/* Trend Chart */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-in slide-up">
                        <div className="flex items-center gap-2 mb-6 text-[#001D3D] font-bold"><BarChart3 className="w-5 h-5 text-[#1B5E20]" /> Inventory Trend</div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34D399" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey="stock" stroke="#1B5E20" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-in slide-up delay-75">
                        <div className="flex items-center gap-2 mb-6 text-[#001D3D] font-bold"><Box className="w-5 h-5 text-blue-500" /> Items by Category</div>
                        <div className="h-64 w-full overflow-y-auto pr-2">
                            <div style={{ height: Math.max(200, categoryChartData.length * 45) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} width={130} />
                                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name, props) => [value, props.payload.fullName || name]} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                            {categoryChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Action Area: Reorders & Smart Discounts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 mt-4 animate-in slide-up duration-500 delay-100">

                {/* 1. Supplier Reorder Generator */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/50 dark:border-indigo-800/50 rounded-[1.5rem] p-6 shadow-lg shadow-indigo-900/5">
                    <div className="flex items-center gap-2 mb-2 text-indigo-900 dark:text-indigo-300 font-bold"><FileText className="w-5 h-5" /> Supplier Reorder</div>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-4 line-clamp-2">Automatically generate a PDF purchase order for all {data.filter(i => i.quantity > 0 && i.quantity <= 5).length} items currently marked as "Low Stock".</p>
                    <button
                        onClick={() => {
                            const lowStock = data.filter(i => i.quantity > 0 && i.quantity <= 5);
                            if (lowStock.length === 0) return alert('No low stock items to reorder!');
                            const doc = new jsPDF();
                            doc.setFontSize(22);
                            doc.text('PantryPal+ Purchase Order (Restock Request)', 14, 20);
                            doc.setFontSize(10);
                            doc.setTextColor(100);
                            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
                            doc.text(`Retailer: ${user.name || 'Store Manager'}`, 14, 35);
                            doc.setFontSize(12);
                            doc.setTextColor(0);
                            let y = 50;
                            lowStock.forEach((item, i) => {
                                doc.text(`${i + 1}. ${item.name} (Barcode: ${item.barcode || 'N/A'}) - Requesting Restock`, 14, y);
                                doc.text(`Current Qty: ${item.quantity} ${item.quantityUnit}`, 20, y + 6);
                                y += 15;
                                if (y > 270) { doc.addPage(); y = 20; }
                            });
                            doc.save(`Reorder_Request_${new Date().toISOString().split('T')[0]}.pdf`);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 w-full text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Generate Order PDF
                    </button>
                </div>

                {/* 2. Smart Discounts AI */}
                <div className="bg-gradient-to-br from-[#FFF9E6] to-[#fff3cd] dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50 rounded-[1.5rem] p-6 shadow-lg shadow-amber-900/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex items-center gap-2 mb-2 text-amber-900 dark:text-amber-400 font-bold relative z-10"><Wand2 className="w-5 h-5 text-amber-500" /> Smart Action Needed</div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-4 relative z-10 line-clamp-2">
                        You have <span className="font-black text-rose-600 dark:text-rose-400">{nearExpiryCount}</span> items nearing expiry. Use AI to auto-discount them by 20% to clear inventory faster.
                    </p>
                    <button
                        onClick={async () => {
                            if (!window.confirm(`Auto-apply 20% discount to ${nearExpiryCount} fragile items?`)) return;
                            const vulnerable = data.filter(i => i.expiryStatus === 'near' || i.expiryStatus === 'urgent');
                            for (let item of vulnerable) {
                                // Simulate sending an update request to the server to manually flag/discount them.
                                // The backend calculation handles "base" discounts natively based on date,
                                // but we can trigger a refresh alert to simulate the action.
                            }
                            alert('Smart Discounts Applied! (Simulation for now as prices are auto-calculated by server)');
                        }}
                        disabled={nearExpiryCount === 0}
                        className={`w-full text-white text-sm font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 relative z-10 ${nearExpiryCount > 0 ? 'bg-amber-500 hover:bg-amber-600 cursor-pointer' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-70'}`}
                    >
                        <Ticket className="w-4 h-4" /> Apply 20% Discount
                    </button>
                </div>

            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color, sub }) => (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm min-w-[140px] flex-1 hover-lift">
        <div className="flex justify-between items-start mb-3"><span className="font-bold text-slate-500 text-xs">{title}</span><div className={`p-2 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}><Icon className="w-5 h-5" /></div></div>
        <span className="text-3xl font-black text-[#001D3D]">{value}</span>
        {sub && <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>}
    </div>
);

const SuggestionRow = ({ icon: Icon, title, desc }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm flex gap-3 items-start border border-amber-100/50"><Icon className="w-5 h-5 text-amber-500 mt-0.5" /><div><h4 className="font-bold text-[#001D3D] text-sm">{title}</h4><p className="text-xs text-slate-500">{desc}</p></div></div>
);

const AddStockScreen = ({ onBack, refresh }) => {
    const [mode, setMode] = useState('manual');
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        barcode: '',
        exp: '',
        qty: '',
        qtyUnit: '',
        price: '',
        category: 'General',
        brand: '',
        description: '',
        netWeight: '',
        servingSize: '',
        ingredients: [],
        nutritionFacts: {},
        images: [],
        confidence: 0,
        source: ''
    });

    const handleScan = async (code, productData = null) => {
        setLoading(true);
        try {
            // If product data is provided (from OpenFoodFacts), use it directly
            if (productData) {
                setForm({
                    name: productData.name,
                    barcode: code,
                    exp: '',
                    qty: '',
                    qtyUnit: productData.qtyUnit || '',
                    price: productData.price || '',
                    category: productData.category || 'General',
                    brand: productData.brand || '',
                    description: productData.description || '',
                    netWeight: productData.netWeight || '',
                    servingSize: productData.servingSize || '',
                    ingredients: productData.ingredients || [],
                    nutritionFacts: productData.nutritionFacts || {},
                    images: productData.images || [],
                    confidence: productData.confidence || 0,
                    source: productData.source || 'OpenFoodFacts'
                });
                setLoading(false);
                setMode('manual');
                return;
            }

            // Original logic for inventory lookup
            const item = await fetcher(`/inventory/by-barcode/${encodeURIComponent(code)}`);
            if (item && !item.error && item.message !== 'Product not found') {
                setForm({
                    name: item.name,
                    barcode: item.barcode || code,
                    exp: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
                    qty: item.quantity,
                    qtyUnit: item.quantityUnit || '',
                    price: item.price,
                    category: item.category || 'General',
                    brand: item.brand || '',
                    description: item.description || '',
                    netWeight: item.netWeight || '',
                    servingSize: item.servingSize || '',
                    ingredients: item.ingredients || [],
                    nutritionFacts: item.nutritionFacts || {},
                    images: item.images || [],
                    confidence: item.confidence || 0,
                    source: item.source || 'Inventory'
                });
            } else {
                // Not in our inventory -> try global product DB (OpenFoodFacts)
                const g = await fetcher(`/barcode/lookup/${encodeURIComponent(code)}`);
                if (g && !g.error && g.message !== 'Product not found') {
                    setForm(f => ({
                        ...f,
                        barcode: code,
                        name: g.name || f.name || '',
                        brand: g.brand || f.brand || '',
                        description: g.description || f.description || '',
                        netWeight: g.netWeight || f.netWeight || '',
                        servingSize: g.servingSize || f.servingSize || '',
                        ingredients: g.ingredients || f.ingredients || [],
                        nutritionFacts: g.nutritionFacts || f.nutritionFacts || {},
                        images: g.images || f.images || [],
                        confidence: g.confidence || f.confidence || 0,
                        source: g.source || f.source || '',
                        qtyUnit: g.qtyUnit || f.qtyUnit || '',
                        category: g.category || f.category || 'General',
                        price: g.price != null ? g.price : f.price,
                    }));
                } else {
                    setForm(f => ({
                        ...f,
                        barcode: code,
                        name: f.name || '',
                        brand: f.brand || '',
                        description: f.description || '',
                        netWeight: f.netWeight || '',
                        servingSize: f.servingSize || '',
                        ingredients: f.ingredients || [],
                        nutritionFacts: f.nutritionFacts || {},
                        images: f.images || [],
                        confidence: f.confidence || 0,
                        source: f.source || ''
                    }));
                }
            }
        } catch (e) {
            setForm(f => ({
                ...f,
                barcode: code,
                name: f.name || '',
                brand: f.brand || '',
                description: f.description || '',
                netWeight: f.netWeight || '',
                servingSize: f.servingSize || '',
                ingredients: f.ingredients || [],
                nutritionFacts: f.nutritionFacts || {},
                images: f.images || [],
                confidence: f.confidence || 0,
                source: f.source || ''
            }));
        }
        setLoading(false);
        setMode('manual');
    };

    const save = async () => {
        if (!form.name) return;
        setLoading(true);
        // ... (rest of the code remains the same)
        await fetcher('/inventory', {
            method: 'POST',
            body: JSON.stringify({
                name: form.name,
                barcode: form.barcode,
                expiryDate: form.exp,
                quantity: Number(form.qty),
                quantityUnit: form.qtyUnit,
                price: Number(form.price),
                category: form.category,
                brand: form.brand,
                description: form.description,
                netWeight: form.netWeight,
                servingSize: form.servingSize,
                ingredients: form.ingredients,
                nutritionFacts: form.nutritionFacts,
                images: form.images,
                confidence: form.confidence,
                source: form.source
            })
        });
        setLoading(false);
        refresh();
        alert("Stock added!");
        onBack();
    };

    return (
        <div className="animate-in slide-in-from-right-10 duration-500 pb-24">
            <div className="flex items-center gap-4 mb-8"><button onClick={onBack} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:bg-slate-50"><ArrowLeft className="w-6 h-6 text-[#001D3D]" /></button><h1 className="text-2xl font-black text-[#001D3D]">Add Stock</h1></div>
            <div className="grid grid-cols-4 gap-2 mb-8">
                {['Manual', 'Scanner', 'AI Vision', 'Generate'].map((m) => (<button key={m} onClick={() => setMode(m.toLowerCase())} className={`py-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all border ${mode === m.toLowerCase() ? 'bg-[#001D3D] text-white border-[#001D3D]' : 'bg-white text-slate-400 border-slate-200'}`}>{m}</button>))}
            </div>

            {(mode === 'scanner' || mode === 'ai vision') ? (
                <div className="space-y-4">
                    <SimpleScanner onScan={handleScan} />
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 mb-2">Or enter barcode manually</p>
                        <div className="flex gap-2">
                            <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-[#1B5E20]" placeholder="e.g. 8901234560050" />
                            <button onClick={() => form.barcode && handleScan(form.barcode)} className="bg-[#1B5E20] text-white px-5 rounded-xl font-bold text-sm">Lookup</button>
                        </div>
                    </div>
                </div>
            ) : mode === 'generate' ? (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl text-center">
                        <h3 className="font-bold text-[#001D3D] text-lg mb-2">Custom SKU Generator</h3>
                        <p className="text-xs text-slate-500 mb-8">Create a unique barcode for items without one (e.g. homemade goods).</p>

                        <div className="bg-slate-50 p-6 rounded-2xl flex justify-center mb-8 overflow-hidden min-h-[120px] items-center border border-slate-200">
                            {form.barcode ? <Barcode value={form.barcode} height={60} fontSize={16} background="transparent" /> : <div className="text-slate-400 text-sm font-bold flex flex-col items-center gap-2"><ScanLine className="w-8 h-8 opacity-50" />Click Auto-Generate</div>}
                        </div>

                        <div className="flex gap-3">
                            <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Custom SKU" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#1B5E20] transition-colors" />
                            <button onClick={() => setForm({ ...form, barcode: `SKU-${Math.floor(Math.random() * 1000000)}` })} className="bg-emerald-100 text-[#1B5E20] px-6 py-3 rounded-xl text-sm font-black hover:bg-emerald-200 transition-colors">Auto</button>
                        </div>
                    </div>
                    <Button className="w-full bg-[#001D3D] text-white py-4 text-sm mt-4 rounded-xl shadow-lg" onClick={() => setMode('manual')} disabled={!form.barcode}>Use This Code & Fill Details</Button>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl space-y-6">
                    <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Input label="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                    <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Category</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-medium outline-none text-[#001D3D]" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>General</option><option>Dairy</option><option>Bakery</option><option>Medicines</option><option>Snacks</option></select></div>
                    <div className="grid grid-cols-2 gap-4"><Input label="Qty" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /><Input label="Unit (e.g. 100ml, 50g)" value={form.qtyUnit} onChange={e => setForm({ ...form, qtyUnit: e.target.value })} placeholder="100ml" /></div>
                    <div className="grid grid-cols-2 gap-4"><Input label="Price (₹)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /><Input label="Expiry" type="date" value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} /></div>
                    <Button onClick={save} className="w-full mt-4">Save Stock</Button>
                </div>
            )}
        </div >
    );
};

const ProductsScreen = ({ inventory, onBack, refresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    const data = Array.isArray(inventory) ? inventory : [];

    const deleteItem = async (id) => {
        if (!window.confirm('Delete this item from inventory?')) return;
        await fetcher(`/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
        refresh?.();
    };

    // Extract unique categories for the filter dropdown
    const categories = ['All', 'Low Stock', ...new Set(data.map(item => item.category || 'General'))];

    // Filter logic
    const filteredData = data.filter(item => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || item.barcode?.includes(searchTerm);
        const matchesCategory = filterCategory === 'All'
            ? true
            : filterCategory === 'Low Stock'
                ? (item.quantity > 0 && item.quantity <= 5)
                : item.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="animate-in fade-in pb-24">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4"><button onClick={onBack} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:bg-slate-50"><ArrowLeft className="w-6 h-6 text-[#001D3D]" /></button><h1 className="text-3xl font-black text-[#001D3D]">Inventory</h1></div>
                <button onClick={() => exportToCSV(data, 'Full_Inventory')} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors"><FileText className="w-4 h-4" /> Export CSV</button>
            </div>

            {/* Smart Search & Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search products or barcode..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1B5E20] transition-colors" />
                </div>
                <div className="relative min-w-[140px]">
                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#1B5E20] appearance-none cursor-pointer">
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>
            {filteredData.length === 0 ? (
                <div className="bg-white rounded-[2rem] p-20 text-center border border-slate-100"><Package className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h3 className="text-xl font-bold text-[#001D3D]">No products found</h3><p className="text-slate-400 text-sm mt-2">Try adjusting your search or filters.</p></div>
            ) : (
                <div className="space-y-4">
                    {filteredData.map((item, i) => {
                        const c = expiryColor(item);
                        return (
                            <div key={item._id} className={`p-5 rounded-[2rem] border shadow-sm flex items-center justify-between hover-lift animate-in slide-up ${item.expiryStatus === 'urgent' ? 'border-red-200 bg-red-50/30' : item.expiryStatus === 'near' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-white'}`} style={{ animationDelay: `${(i % 10) * 50}ms` }}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${c.bg} ${c.text}`}>{item.expiryStatus === 'urgent' || item.finalDiscount > 0 ? <Flame className="fill-current pulse-soft" /> : <Package />}</div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-[#001D3D] text-lg">{item.name}</h4>
                                            {item.quantity > 0 && item.quantity <= 5 && <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-md">LOW STOCK</span>}
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold uppercase mt-1">Qty: {item.quantity} {item.quantityUnit} • {item.category}</p>
                                    </div>
                                </div>
                                <div className="text-right space-y-2">
                                    {item.finalDiscount > 0 ? (
                                        <div className={`${c.badge} text-white px-3 py-1 rounded-lg text-[10px] font-black mb-1 ${item.expiryStatus === 'urgent' ? 'animate-pulse' : ''}`}>{item.finalDiscount}% OFF</div>
                                    ) : (
                                        <div className={`${c.text} text-[10px] font-black mb-1`}>{item.expiryStatus === 'near' ? 'NEAR EXPIRY' : 'FRESH'}</div>
                                    )}
                                    <p className="text-xl font-black text-[#001D3D]">{formatPrice(item.price)}</p>
                                    <button onClick={() => deleteItem(item._id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- POS Sales Screen (New Sale + Purchase History) ---
const SalesScreen = ({ onBack, inventory, onSaleComplete }) => {
    const [subTab, setSubTab] = useState('sale');
    const [scanInput, setScanInput] = useState('');
    const [scanQty, setScanQty] = useState(1);
    const [manualInput, setManualInput] = useState('');
    const [manualQty, setManualQty] = useState(1);
    const [cart, setCart] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [customerPhone, setCustomerPhone] = useState('');
    const [checkoutResult, setCheckoutResult] = useState(null);
    const [purchases, setPurchases] = useState([]);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const scanRef = useRef(null);
    const inv = Array.isArray(inventory) ? inventory : [];

    const addByBarcode = async (barcode, units = 1) => {
        const item = await fetcher(`/inventory/by-barcode/${encodeURIComponent(barcode)}`);
        if (item && !item.error && item.message !== 'Product not found') {
            const total = (item.price || 0) * units;
            setCart(c => [...c, { id: Date.now() + Math.random(), productId: item._id, name: item.name, barcode: item.barcode, category: item.category || 'General', quantityUnit: item.quantityUnit || '', units: Number(units), price: item.price, total, expiryDate: item.expiryDate }]);
        } else { alert('Product not found. Add to inventory first.'); }
    };
    const addByName = (name, units = 1) => {
        const item = inv.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
        if (item) {
            const total = (item.price || 0) * units;
            setCart(c => [...c, { id: Date.now() + Math.random(), productId: item._id, name: item.name, barcode: item.barcode, category: item.category || 'General', quantityUnit: item.quantityUnit || '', units: Number(units), price: item.price, total, expiryDate: item.expiryDate }]);
        } else { alert('Product not found in inventory.'); }
    };
    const handleScanSubmit = (e) => { e?.preventDefault(); if (scanInput.trim()) { addByBarcode(scanInput.trim(), scanQty); setScanInput(''); setScanQty(1); } };
    const handleManualSubmit = (e) => { e?.preventDefault(); if (manualInput.trim()) { addByName(manualInput.trim(), manualQty); setManualInput(''); setManualQty(1); } };
    const removeFromCart = (id) => setCart(c => c.filter(x => x.id !== id));
    const updateCartItem = (id, updates) => setCart(c => c.map(x => x.id === id ? { ...x, ...updates, total: (updates.units ?? x.units) * (updates.price ?? x.price) } : x));
    const totalBill = cart.reduce((s, i) => s + (i.total || 0), 0);

    const checkout = async () => {
        if (cart.length === 0) { alert('Add items first'); return; }
        const phone = String(customerPhone || '').replace(/\D/g, '');
        if (!phone || phone.length < 10) { alert('Enter customer phone number (10 digits) to generate passcode'); return; }
        setLoading(true);
        const data = await fetcher('/sales', { method: 'POST', body: JSON.stringify({ items: cart.map(i => ({ productId: i.productId, name: i.name, barcode: i.barcode, category: i.category, quantityUnit: i.quantityUnit, units: i.units, price: i.price, total: i.total })), customerPhone: phone }) });
        setLoading(false);
        if (data && data.passcode) {
            setCheckoutResult(data);
            setCart([]);
            setCustomerPhone('');
            // Update sales today immediately (then backend refresh reconciles)
            onSaleComplete?.(Number(data.totalAmount ?? totalBill));
        } else { alert(data?.message || 'Checkout failed'); }
    };

    const downloadPDF = () => {
        if (!checkoutResult) return;
        const items = Array.isArray(checkoutResult.items) ? checkoutResult.items : [];
        const tot = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 40;
        const colItem = margin;
        const colQty = pageW * 0.65;
        const colPrice = pageW * 0.80;
        const colAmt = pageW - margin;
        const lineH = 14;
        let y = 56;

        const drawHeader = () => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('PantryPal+ Receipt', pageW / 2, y, { align: 'center' });
            y += 22;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(`Passcode: ${checkoutResult.passcode}`, margin, y);
            doc.text(`Date: ${new Date(checkoutResult.createdAt || Date.now()).toLocaleString()}`, pageW - margin, y, { align: 'right' });
            y += 18;
            const cust = normalizePhone10(checkoutResult.customerPhone);
            if (cust) doc.text(`Customer: +91${cust}`, margin, y);
            y += 18;
            doc.setDrawColor(220);
            doc.line(margin, y, pageW - margin, y);
            y += 18;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('Item', colItem, y);
            doc.text('Qty', colQty, y, { align: 'right' });
            doc.text('Price', colPrice, y, { align: 'right' });
            doc.text('Amount', colAmt, y, { align: 'right' });
            y += 10;
            doc.setFont('helvetica', 'normal');
            doc.line(margin, y, pageW - margin, y);
            y += 16;
        };

        drawHeader();

        doc.setFontSize(10);
        for (let i = 0; i < items.length; i++) {
            const it = items[i] || {};
            const name = String(it.name || 'Item');
            const qty = Number(it.units || 0);
            const price = Number(it.price || 0);
            const amt = Number(it.total || 0);

            const nameLines = doc.splitTextToSize(name, (colQty - colItem) - 10);
            const rowH = Math.max(nameLines.length * lineH, lineH);
            if (y + rowH > pageH - 120) {
                doc.addPage();
                y = 56;
                drawHeader();
            }
            doc.text(nameLines, colItem, y);
            doc.text(String(qty), colQty, y, { align: 'right' });
            doc.text(`₹${price.toFixed(2)}`, colPrice, y, { align: 'right' });
            doc.text(`₹${amt.toFixed(2)}`, colAmt, y, { align: 'right' });
            y += rowH;
        }

        y += 10;
        doc.setDrawColor(220);
        doc.line(margin, y, pageW - margin, y);
        y += 22;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`Total: ₹${tot.toFixed(2)}`, pageW - margin, y, { align: 'right' });
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Thank you for shopping!', pageW / 2, y, { align: 'center' });

        doc.save(`receipt-${checkoutResult.passcode}.pdf`);
    };

    const loadPurchases = async () => { const list = await fetcher('/sales'); setPurchases(Array.isArray(list) ? list : []); };
    useEffect(() => { if (subTab === 'history') loadPurchases(); }, [subTab]);

    return (
        <div className="animate-in fade-in pb-24 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all duration-200"><ArrowLeft className="w-6 h-6 text-[#001D3D]" /></button>
                <h1 className="text-2xl font-black text-[#001D3D]">Sales (POS)</h1>
            </div>
            <div className="flex gap-2 mb-6">
                <button onClick={() => { setSubTab('sale'); setCheckoutResult(null); setSelectedPurchase(null); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${subTab === 'sale' ? 'bg-[#1B5E20] text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>New Sale</button>
                <button onClick={() => setSubTab('history')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${subTab === 'history' ? 'bg-[#1B5E20] text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Purchase History</button>
            </div>

            {subTab === 'sale' && !selectedPurchase && (
                <div className="space-y-4 transition-all duration-300">
                    {!checkoutResult ? (
                        <>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <p className="text-xs font-bold text-slate-500 mb-2">Scan or enter barcode</p>
                                <form onSubmit={handleScanSubmit} className="flex gap-2">
                                    <input ref={scanRef} value={scanInput} onChange={e => setScanInput(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-4 py-3 font-medium text-sm outline-none focus:border-[#1B5E20] transition-colors" placeholder="Scan barcode" />
                                    <input type="number" min="1" value={scanQty} onChange={e => setScanQty(Math.max(1, +e.target.value || 1))} className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 text-center font-medium text-sm" />
                                    <button type="submit" className="bg-[#1B5E20] text-white px-4 rounded-xl font-bold text-sm">Add</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <p className="text-xs font-bold text-slate-500 mb-2">Or enter product name</p>
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input value={manualInput} onChange={e => setManualInput(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:border-[#1B5E20] transition-colors" placeholder="Product name" />
                                    <input type="number" min="1" value={manualQty} onChange={e => setManualQty(Math.max(1, +e.target.value || 1))} className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-3 text-center font-medium text-sm" />
                                    <button type="submit" className="bg-[#1B5E20] text-white px-4 rounded-xl font-bold text-sm">Add</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="bg-slate-50 text-left text-xs font-bold text-slate-600"><th className="p-3">#</th><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Units</th><th className="p-3">Price</th><th className="p-3">Total</th><th></th></tr></thead>
                                        <tbody>
                                            {cart.map((row, i) => (
                                                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-medium">{i + 1}</td>
                                                    <td className="p-3">{row.name} {row.quantityUnit && <span className="text-slate-400">({row.quantityUnit})</span>}</td>
                                                    <td className="p-3">{editingId === row.id ? <input type="number" min="1" value={row.units} onChange={e => updateCartItem(row.id, { units: +e.target.value })} className="w-14 border rounded px-2 py-1" /> : row.units}</td>
                                                    <td className="p-3">—</td>
                                                    <td className="p-3">{editingId === row.id ? <input type="number" min="0" step="0.01" value={row.price} onChange={e => updateCartItem(row.id, { price: +e.target.value })} className="w-20 border rounded px-2 py-1" /> : formatPrice(row.price)}</td>
                                                    <td className="p-3 font-bold">{formatPrice(row.total)}</td>
                                                    <td className="p-3"><button onClick={() => setEditingId(editingId === row.id ? null : row.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button><button onClick={() => removeFromCart(row.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 ml-1"><Trash2 className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {cart.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">No items. Scan or add by name.</p>}
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <p className="text-xs font-bold text-slate-500 mb-2">Customer phone number (required)</p>
                                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:border-[#1B5E20] transition-colors" placeholder="9876543210" maxLength={10} />
                                <p className="text-xs text-slate-400 mt-1">Customer must login with this number to claim the passcode</p>
                            </div>
                            <div className="flex justify-between items-center bg-[#1B5E20] text-white p-5 rounded-2xl">
                                <span className="font-bold">Total Bill</span>
                                <span className="text-2xl font-black">{formatPrice(totalBill)}</span>
                            </div>
                            <Button onClick={checkout} loading={loading} className="w-full bg-[#001D3D]">Checkout & Generate Passcode</Button>
                        </>
                    ) : (
                        <div className="bg-white rounded-2xl border-2 border-[#1B5E20] p-8 text-center shadow-xl animate-in zoom-in duration-300">
                            <CheckCircle2 className="w-16 h-16 text-[#1B5E20] mx-auto mb-4" />
                            <h3 className="text-xl font-black text-[#001D3D] mb-2">Sale Complete!</h3>
                            <p className="text-4xl font-black text-[#1B5E20] tracking-[0.3em] mb-4">{checkoutResult.passcode}</p>
                            <p className="text-sm text-slate-500 mb-6">Give this passcode to the customer. They must login with the phone number you entered, then enter this passcode to see their purchase.</p>
                            <div className="flex gap-3 justify-center">
                                <Button onClick={downloadPDF} variant="outline" className="flex items-center gap-2"><Download className="w-5 h-5" /> Download Bill (PDF)</Button>
                                <Button onClick={() => setCheckoutResult(null)}>New Sale</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {subTab === 'history' && !selectedPurchase && (
                <div className="space-y-3">
                    {purchases.length === 0 ? <div className="bg-white rounded-2xl p-12 text-center text-slate-400"><History className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No purchases yet</p></div> : purchases.map(p => (
                        <button key={p._id} onClick={() => setSelectedPurchase(p)} className="w-full bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-all duration-200 text-left">
                            <div><p className="font-bold text-[#001D3D]">Passcode: {p.passcode}</p><p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</p></div>
                            <div className="text-right"><p className="font-black text-[#1B5E20]">{formatPrice(p.totalAmount)}</p><ChevronRight className="w-5 h-5 text-slate-300 ml-2" /></div>
                        </button>
                    ))}
                </div>
            )}

            {selectedPurchase && (
                <div className="animate-in slide-in-from-right-4">
                    <button onClick={() => setSelectedPurchase(null)} className="flex items-center gap-2 text-slate-500 font-bold text-sm mb-6"><ArrowLeft className="w-5 h-5" /> Back</button>
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50 border-b"><p className="font-bold">Passcode: {selectedPurchase.passcode}</p><p className="text-xs text-slate-500">{new Date(selectedPurchase.createdAt).toLocaleString()}</p></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-slate-50 text-left text-xs font-bold text-slate-600"><th className="p-3">#</th><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Price</th><th className="p-3">Total</th></tr></thead>
                                <tbody>{selectedPurchase.items?.map((it, i) => (<tr key={i} className="border-t"><td className="p-3">{i + 1}</td><td className="p-3">{it.name} {it.quantityUnit && `(${it.quantityUnit})`}</td><td className="p-3">{it.units}</td><td className="p-3">{formatPrice(it.price)}</td><td className="p-3 font-bold">{formatPrice(it.total)}</td></tr>))}</tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-between"><span className="font-bold">Total</span><span className="font-black text-[#1B5E20]">{formatPrice(selectedPurchase.totalAmount)}</span></div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DiscountsScreen = ({ inventory, onBack }) => {
    const data = Array.isArray(inventory) ? inventory : [];
    return (
        <div className="animate-in fade-in pb-24">
            <div className="flex items-center gap-4 mb-8"><button onClick={onBack} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:bg-slate-50"><ArrowLeft className="w-6 h-6 text-[#001D3D]" /></button><h1 className="text-3xl font-black text-[#001D3D]">Discounts</h1></div>
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 mb-8"><h3 className="font-bold text-md text-[#001D3D] mb-4 flex items-center gap-2"><ScanLine className="w-5 h-5" /> Scan or Enter Barcode</h3><div className="flex gap-2 mb-4"><input className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none" placeholder="Scan barcode or type manually" /><button className="bg-[#1B5E20] text-white px-6 rounded-xl font-bold text-sm">Check</button></div><p className="text-xs text-slate-400 flex items-center gap-2"><Lightbulb className="w-3 h-3 text-amber-500" /> Tip: Scan product to see batch discounts.</p></div>
            <div className="space-y-3">{data.filter(i => i.finalDiscount > 0 || i.expiryStatus === 'near' || i.expiryStatus === 'urgent').map(item => { const c = expiryColor(item); return (<div key={item._id} className={`p-5 rounded-[2rem] border shadow-sm flex items-center justify-between ${item.expiryStatus === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}><div className="flex items-center gap-4"><div className={`w-14 h-14 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center text-2xl`}><Percent /></div><div><h4 className="font-bold text-[#001D3D] text-lg">{item.name}</h4><p className={`text-xs font-bold uppercase mt-1 ${item.expiryStatus === 'urgent' ? 'text-red-600' : 'text-amber-600'}`}>Exp: {formatDate(item.expiryDate)}</p></div></div><div className="text-right"><div className={`${c.badge} text-white px-3 py-1 rounded-lg text-[10px] font-black mb-1 ${item.expiryStatus === 'urgent' ? 'animate-pulse' : ''}`}>{item.finalDiscount}% OFF</div><p className="text-xl font-black text-[#001D3D]">{formatPrice(item.price)}</p></div></div>); })}</div>
        </div>
    );
};

const VoiceInputButton = ({ onResult }) => {
    const [listening, setListening] = useState(false);

    const toggleListen = () => {
        if (listening) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice input is not supported in this browser.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onstart = () => setListening(true);
        recognition.onresult = (e) => onResult(e.results[0][0].transcript);
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);
        recognition.start();
    };

    return (
        <button type="button" onClick={toggleListen} title="Voice Input" className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <Mic className="w-5 h-5" />
        </button>
    );
};

// Add a Chatbot component specifically for the Customer App
const CustomerChatbot = ({ inventory, user, onClose, apiKey }) => {
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([{ role: 'bot', text: `Hi ${user.name}! I am your Pantry Culinary Assistant. Ask me how to cook with your items!` }]);
    const [loading, setLoading] = useState(false);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        const msg = query.trim();
        setQuery('');
        setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
        setLoading(true);
        try {
            const res = await fetcher('/ai/customer-chat', { 
                method: 'POST', 
                body: JSON.stringify({ message: msg, inventory, apiKey }) 
            });
            if (res && res.answer) {
                setChatHistory(prev => [...prev, { role: 'bot', text: res.answer }]);
            } else {
                setChatHistory(prev => [...prev, { role: 'bot', text: res?.error || 'Sorry, I encountered an error connecting to the AI.' }]);
            }
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'bot', text: 'Error reaching AI service.' }]);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col animate-in slide-in-from-bottom">
            <div className="flex items-center gap-4 p-6 bg-slate-800 text-white shadow-md z-10 relative">
                <button onClick={onClose} className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600"><ArrowLeft className="w-5 h-5" /></button>
                <div className="flex items-center gap-3"><ChefHat className="text-amber-400 w-6 h-6" /><h2 className="text-xl font-bold">ChefBot</h2></div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900 border-t border-slate-700 relative z-0">
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'bot' ? 'items-start' : 'items-start flex-row-reverse'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg border-2 ${msg.role === 'bot' ? 'bg-gradient-to-tr from-amber-400 to-orange-500 border-amber-200 text-white text-xl pb-1' : 'bg-emerald-100 border-emerald-200 text-emerald-700'}`}>
                            {msg.role === 'bot' ? '🤖' : <User className="w-5 h-5" />}
                        </div>
                        <div className={`px-5 py-4 rounded-3xl max-w-[80%] text-sm shadow-md font-medium leading-relaxed ${msg.role === 'bot' ? 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700' : 'bg-emerald-600 text-white rounded-tr-sm'}`}>
                            {msg.text.split('\n').map((line, x) => <p key={x} className="mb-1">{line}</p>)}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white text-xl pb-1 flex items-center justify-center shrink-0 border-2 border-amber-200">🤖</div>
                        <div className="px-5 py-4 rounded-3xl bg-slate-800 border border-slate-700 text-slate-400 rounded-tl-sm text-sm animate-pulse shadow-md font-medium">Looking at your pantry...</div>
                    </div>
                )}
            </div>
            <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-700 bg-slate-800 flex gap-3 w-full relative z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
                <VoiceInputButton onResult={(text) => setQuery(prev => prev ? prev + ' ' + text : text)} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="E.g., What can I make with pasta?" className="flex-1 bg-slate-900 text-white border border-slate-600 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:border-amber-500 shadow-inner" />
                <button type="submit" disabled={loading || !query.trim()} className="bg-amber-500 text-slate-900 w-14 h-14 rounded-2xl flex items-center justify-center disabled:opacity-50 shadow-lg hover:bg-amber-400 transition-colors"><MessageSquare className="w-6 h-6 fill-current" /></button>
            </form>
        </div>
    );
};

// --- CUSTOMER APP ---
const CustomerApp = ({ user, inventory, onLogout, refresh }) => {
    const [tab, setTab] = useState('home');
    const [recipe, setRecipe] = useState(null);
    const [claimCode, setClaimCode] = useState('');
    const [claiming, setClaiming] = useState(false);
    const [claimMsg, setClaimMsg] = useState('');
    const [showBot, setShowBot] = useState(false);
    const data = Array.isArray(inventory) ? inventory : [];

    const handleClaim = async () => {
        if (!claimCode || claimCode.length !== 6) { setClaimMsg('Enter 6-digit passcode from receipt'); return; }
        setClaiming(true); setClaimMsg('');
        const res = await fetcher('/purchases/claim', { method: 'POST', body: JSON.stringify({ passcode: claimCode }) });
        setClaiming(false);
        if (res && res.message === 'Purchase claimed!') {
            setClaimCode('');
            const items = Array.isArray(res.items) ? res.items : [];
            const summary = items.slice(0, 5).map(it => `${it.name} x${it.units || 1}`).join(', ');
            const more = items.length > 5 ? `, +${items.length - 5} more` : '';
            setClaimMsg(summary ? `Items purchased: ${summary}${more}` : 'Success! Items added to your pantry.');
            refresh?.();
        } else {
            setClaimMsg(res?.message || 'Invalid or already used passcode');
        }
    };

    // RECIPE GENERATOR — API Integrated with Endee AI Vector Search
    const generateRecipe = async () => {
        setRecipe({ title: "Loading...", desc: "Scanning your pantry and asking AI...", ingredients: [] });

        const items = data.map(i => i.name.toLowerCase());
        
        if (items.length === 0) {
            return setRecipe({ title: "No items yet", desc: "Claim a purchase with your receipt passcode to add items.", ingredients: [] });
        }

        try {
            // Call our new Endee backend AI endpoint
            const res = await fetcher('/recipes/recommend', {
                method: 'POST',
                body: JSON.stringify({ 
                    ingredients: items,
                    apiKey: localStorage.getItem('pantryGeminiKey')
                })
            });

            if (res && res.success && res.recipes && res.recipes.length > 0) {
                // Get the top recommendation
                const topMatch = res.recipes[0];
                
                setRecipe({
                    title: topMatch.title,
                    desc: topMatch.instructions || "A delicious AI-recommended recipe based on your pantry.",
                    ingredients: topMatch.ingredients ? topMatch.ingredients.split(',') : [],
                    score: topMatch.score // Optional: show confidence score
                });
            } else {
                throw new Error("No recipes found");
            }
        } catch (e) {
            console.error("Recipe AI Error:", e);
            setRecipe({ 
                title: "AI Offline Mode", 
                desc: "Could not reach the Endee Recipe AI. Try a simple soup or salad with what you have!", 
                ingredients: items.slice(0, 3) 
            });
        }
    };

    return (
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative flex flex-col border-x border-slate-100">
            <div className="p-6 flex-1 overflow-y-auto pb-32">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3"><button onClick={onLogout} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><ChevronLeft size={20} /></button><div><h1 className="text-3xl font-black text-[#001D3D] mb-1">Hello, {user.name || 'User'}! 👋</h1><p className="text-slate-400 font-medium text-sm">Welcome back</p></div></div>
                    <div className="w-10 h-10 bg-[#1B5E20] text-white rounded-full flex items-center justify-center font-bold text-lg">{user.name ? user.name[0] : 'U'}</div>
                </div>

                {tab === 'home' && (
                    <div className="animate-in fade-in">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-2 text-[#1B5E20] font-bold text-xs"><Box className="w-4 h-4" /> Active Items</div><p className="text-4xl font-black text-[#001D3D]">{data.length}</p></div>
                            <div className="border border-slate-100 rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-2 text-amber-500 font-bold text-xs"><AlertTriangle className="w-4 h-4" /> Near Expiry</div><p className="text-4xl font-black text-[#001D3D]">{data.filter(i => i.finalDiscount > 0).length}</p></div>
                        </div>
                        <div className="border border-slate-100 rounded-2xl p-5 shadow-sm mb-8 transition-all duration-300 hover:shadow-md">
                            <div className="flex items-start gap-4 mb-4"><div className="w-10 h-10 bg-[#1B5E20] rounded-lg flex items-center justify-center text-white"><Ticket className="w-6 h-6" /></div><div><h3 className="font-bold text-[#001D3D]">Claim a Purchase</h3><p className="text-xs text-slate-400">Enter passcode from receipt. Use the same phone you gave at the store.</p></div></div>
                            <div className="flex gap-2"><input value={claimCode} onChange={e => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-[#1B5E20] transition-colors" placeholder="000000" maxLength={6} /><button onClick={handleClaim} disabled={claiming} className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-[#154a19] transition-colors disabled:opacity-70">{claiming ? 'Claiming...' : 'Claim'}</button></div>
                            {claimMsg && <p className={`mt-2 text-sm font-medium ${claimMsg.includes('Success') ? 'text-emerald-600' : 'text-rose-600'}`}>{claimMsg}</p>}
                        </div>

                        {/* RECIPE SECTION */}
                        <div className="bg-[#001D3D] p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-xl mb-8">
                            <Wand2 className="absolute top-4 right-4 text-white/10 w-32 h-32" />
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><ChefHat /> What to cook?</h3>
                            <p className="text-white/60 text-sm mb-6">Recipe suggestions from items you purchased and claimed.</p>

                            {recipe && recipe.title !== "Loading..." ? (
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 animate-in zoom-in group">
                                    {recipe.image && <div className="w-full h-32 mb-3 rounded-xl overflow-hidden bg-white/5"><img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
                                    <h4 className="font-bold">{recipe.title}</h4>
                                    <p className="text-xs text-white/70 mt-1 leading-relaxed">{recipe.desc}</p>
                                    {recipe.ingredients?.length > 0 && <p className="text-xs text-emerald-300 font-medium mt-2">Key Ingredients: {recipe.ingredients.join(', ')}</p>}
                                    {recipe.source && <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="mt-4 block text-center w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg font-bold text-xs transition-colors">View Full Recipe & Instructions</a>}
                                </div>
                            ) : (
                                <button onClick={generateRecipe} disabled={recipe?.title === "Loading..."} className="w-full bg-white text-[#001D3D] py-4 rounded-2xl font-bold shadow-lg disabled:opacity-70 disabled:cursor-not-allowed">
                                    {recipe?.title === "Loading..." ? "Thinking..." : "Suggest Recipe from My Purchases"}
                                </button>
                            )}
                        </div>

                        <h3 className="text-slate-500 font-bold text-sm mb-4">Quick Actions</h3>
                        <div className="space-y-3">
                            <button onClick={() => setTab('items')} className="w-full bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-[#e7cdb8] rounded-xl flex items-center justify-center text-amber-800"><Package className="w-5 h-5" /></div><div><h4 className="font-bold text-[#001D3D]">My Items</h4><p className="text-xs text-slate-400">View items</p></div></div><ChevronRight className="w-5 h-5 text-slate-300" /></button>
                            <button onClick={() => setTab('alerts')} className="w-full bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600"><Bell className="w-5 h-5" /></div><div><h4 className="font-bold text-[#001D3D]">Notifications</h4><p className="text-xs text-slate-400">Check alerts</p></div></div><ChevronRight className="w-5 h-5 text-slate-300" /></button>
                        </div>
                    </div>
                )}
                {tab === 'items' && (<div className="animate-in slide-in-from-right-4"><h2 className="text-2xl font-black text-[#001D3D] mb-6">My Pantry</h2>{data.map(item => { const c = expiryColor(item); return (<div key={item._id} className={`border p-5 rounded-2xl mb-3 flex justify-between items-center shadow-sm ${item.expiryStatus === 'urgent' ? 'bg-red-50 border-red-200' : item.expiryStatus === 'near' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}><div className="flex items-center gap-4"><div className={`w-12 h-12 ${c.bg} rounded-2xl flex items-center justify-center text-2xl`}>📦</div><div><h4 className="font-bold text-[#001D3D]">{item.name}</h4><p className={`text-xs font-bold uppercase ${item.expiryStatus === 'urgent' ? 'text-red-600' : item.expiryStatus === 'near' ? 'text-amber-600' : 'text-slate-400'}`}>{item.daysLeft} days left</p></div></div>{(item.finalDiscount > 0 || item.expiryStatus === 'urgent') && <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full">USE NOW</span>}{item.expiryStatus === 'near' && !item.finalDiscount && <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full">NEAR</span>}</div>); })}</div>)}
                {tab === 'alerts' && (<div className="animate-in slide-in-from-right-4"><h2 className="text-2xl font-black text-[#001D3D] mb-6">Notifications</h2>{data.filter(i => i.finalDiscount > 0 || i.expiryStatus === 'urgent' || i.expiryStatus === 'near').map(item => (<div key={item._id} className={`p-5 rounded-[2rem] mb-4 border flex gap-4 items-start ${item.expiryStatus === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}><div className="bg-white p-2 rounded-full"><Flame className={`w-5 h-5 fill-current ${item.expiryStatus === 'urgent' ? 'text-red-500' : 'text-amber-500'}`} /></div><div><h4 className={`font-bold ${item.expiryStatus === 'urgent' ? 'text-red-900' : 'text-amber-900'}`}>{item.name} is expiring!</h4><p className={`text-xs mt-1 font-medium ${item.expiryStatus === 'urgent' ? 'text-red-700' : 'text-amber-700'}`}>Use within {item.daysLeft} days.</p></div></div>))}{data.filter(i => i.finalDiscount > 0 || i.expiryStatus === 'urgent' || i.expiryStatus === 'near').length === 0 && <div className="text-center py-20 opacity-50"><Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" /><p className="font-bold text-slate-500">No alerts!</p></div>}</div>)}
            </div>
            
            {/* Customer Chatbot Floating Emoji Button */}
            {!showBot && (
                <button onClick={() => setShowBot(true)} className="fixed bottom-24 right-4 z-50 w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(245,158,11,0.5)] hover:scale-110 transition-transform bounce-anim border-4 border-white text-3xl pb-1">
                    🤖
                </button>
            )}

            {showBot && <CustomerChatbot inventory={data} user={user} onClose={() => setShowBot(false)} apiKey={localStorage.getItem('pantryGeminiKey')} />}
            
            <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 p-4 pb-8 flex justify-around rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
                <NavIcon icon={Home} label="Home" active={tab === 'home'} onClick={() => setTab('home')} /><NavIcon icon={Package} label="Items" active={tab === 'items'} onClick={() => setTab('items')} /><NavIcon icon={Bell} label="Alerts" active={tab === 'alerts'} onClick={() => setTab('alerts')} alert={data.filter(i => i.finalDiscount > 0).length > 0} /><NavIcon icon={User} label="Profile" active={false} onClick={onLogout} />
            </div>
        </div>
    );
};

const NavIcon = ({ icon: Icon, label, active, onClick, alert }) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#1B5E20] scale-110' : 'text-slate-400'}`}><div className="relative"><Icon className={`w-6 h-6 ${active ? 'fill-current' : ''}`} />{alert && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>}</div><span className="text-[10px] font-bold">{label}</span></button>);

// --- PHASE 7 COMPONENTS ---

const AnalyticsDashboard = ({ onBack }) => {
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            const data = await fetcher('/sales');
            if (Array.isArray(data)) setSalesData(data);
            setLoading(false);
        };
        fetchSales();
    }, []);

    // Derived stats
    const totalRevenue = salesData.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalItemsSold = salesData.reduce((sum, sale) => sum + (sale.items?.reduce((s, i) => s + (i.units || 1), 0) || 0), 0);

    // Group sales by date for the chart
    const salesByDateMap = salesData.reduce((acc, sale) => {
        const d = new Date(sale.createdAt).toLocaleDateString();
        acc[d] = (acc[d] || 0) + (sale.totalAmount || 0);
        return acc;
    }, {});

    const chartData = Object.entries(salesByDateMap)
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .slice(-7) // last 7 days of activity
        .map(([date, total]) => ({ date: date.slice(0, 5), total }));

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            <button onClick={onBack} className="mb-4 flex items-center text-slate-500 hover:text-[#1B5E20] font-bold text-sm bg-white/50 backdrop-blur w-fit px-4 py-2 rounded-full border border-slate-200">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to More
            </button>
            <h2 className="text-2xl font-black text-[#001D3D] dark:text-white mb-6 flex items-center gap-2"><BarChart3 className="text-indigo-500" /> Analytical View</h2>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-500 text-white rounded-[2rem] p-6 shadow-lg shadow-indigo-500/30">
                            <p className="text-indigo-100 font-bold text-xs uppercase tracking-wider mb-1">Total Revenue</p>
                            <p className="text-3xl font-black">{formatPrice(totalRevenue)}</p>
                        </div>
                        <div className="bg-emerald-500 text-white rounded-[2rem] p-6 shadow-lg shadow-emerald-500/30">
                            <p className="text-emerald-100 font-bold text-xs uppercase tracking-wider mb-1">Items Sold</p>
                            <p className="text-3xl font-black">{totalItemsSold}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-6 rounded-[2rem] shadow-sm">
                        <h3 className="font-bold text-[#001D3D] dark:text-white mb-6">Recent Sales Trend</h3>
                        <div className="h-48 w-full -ml-4">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                                        <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={4} fill="#6366f1" fillOpacity={0.2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 font-medium">No sales data to display yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DailySalesSheet = ({ onBack }) => {
    const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            const data = await fetcher('/sales');
            if (Array.isArray(data)) setSalesData(data);
            setLoading(false);
        };
        fetchSales();
    }, []);

    const handleExportCSV = () => {
        const flatData = salesData.flatMap(sale =>
            (sale.items || []).map(item => ({
                Date: new Date(sale.createdAt).toLocaleDateString(),
                Time: new Date(sale.createdAt).toLocaleTimeString(),
                Passcode: sale.passcode,
                Customer_Phone: sale.customerPhone || 'Walk-in',
                Item: item.name,
                Quantity: item.units || 1,
                Price: item.price,
                Item_Total: item.total || 0,
                Receipt_Total: sale.totalAmount
            }))
        );
        exportToCSV(flatData, 'PantryPal_Daily_Sales');
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            <button onClick={onBack} className="mb-4 flex items-center text-slate-500 hover:text-[#1B5E20] font-bold text-sm bg-white/50 backdrop-blur w-fit px-4 py-2 rounded-full border border-slate-200">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to More
            </button>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-[#001D3D] dark:text-white flex items-center gap-2"><FileText className="text-emerald-500" /> Daily Sales</h2>
                <button onClick={handleExportCSV} disabled={salesData.length === 0} className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center disabled:opacity-50"><Download className="w-5 h-5" /></button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : salesData.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                    <History className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <p className="font-bold text-slate-500 dark:text-slate-400">No recent sales found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {salesData.map(sale => (
                        <div key={sale._id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-bold text-[#001D3D] dark:text-white">{formatPrice(sale.totalAmount)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formatDate(sale.createdAt)} at {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 font-bold rounded-full">#{sale.passcode}</span>
                            </div>
                            <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                {sale.items?.slice(0, 3).map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            {it.name} <span className="text-xs opacity-50">x{it.units || 1}</span>
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{formatPrice(it.total || 0)}</span>
                                    </div>
                                ))}
                                {sale.items?.length > 3 && <p className="text-xs text-slate-400 mt-2 italic">+ {sale.items.length - 3} more items...</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileScreen = ({ user, onBack, onUserUpdate }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return setStatus({ type: 'error', msg: 'New passwords do not match' });
        }
        if (newPassword.length < 6) {
            return setStatus({ type: 'error', msg: 'Password must be at least 6 characters' });
        }

        setLoading(true);
        setStatus({ type: '', msg: '' });

        try {
            const res = await fetcher('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ oldPassword, newPassword })
            });
            if (res.error || res.message) {
                setStatus({ type: 'error', msg: res.message || 'Failed to change password' });
            } else {
                setStatus({ type: 'success', msg: 'Password updated successfully!' });
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'Server connection failed' });
        }
        setLoading(false);
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            <button onClick={onBack} className="mb-4 flex items-center text-slate-500 hover:text-[#1B5E20] font-bold text-sm bg-white/50 backdrop-blur w-fit px-4 py-2 rounded-full border border-slate-200">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to More
            </button>
            <h2 className="text-2xl font-black text-[#001D3D] dark:text-white mb-6 flex items-center gap-2"><UserCircle2 className="text-blue-500" /> Profile</h2>

            <div className="bg-white dark:bg-slate-800 p-6 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm mb-6 flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 mb-4 shadow-inner">
                    <Store className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-[#001D3D] dark:text-white">{user?.name || 'Retailer'}</h3>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{user?.role}</p>
            </div>

            <div className="space-y-4 mb-8">
                <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4">
                    <Smartphone className="w-5 h-5 text-slate-400" />
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Phone Number</p>
                        <p className="font-medium text-[#001D3D] dark:text-white">{user?.phone || 'Not provided'}</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Email (For Alerts)</p>
                        <p className="font-medium text-[#001D3D] dark:text-white">{user?.email || 'Not provided'}</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                        <Zap className="w-5 h-5" />
                        <p className="text-xs font-bold uppercase">Gemini AI Key</p>
                    </div>
                    <input type="password" placeholder="AI API Key (Optional Override)" value={localStorage.getItem('pantryGeminiKey') || ''} onChange={e => { localStorage.setItem('pantryGeminiKey', e.target.value); window.location.reload(); }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm">
                <h3 className="font-bold text-[#001D3D] dark:text-white mb-4 flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> Change Password</h3>

                {status.msg && (
                    <div className={`p-4 rounded-xl mb-4 text-sm font-bold ${status.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'}`}>
                        {status.msg}
                    </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <input type="password" placeholder="Current Password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 text-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 text-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 text-slate-800 dark:text-white" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-70 flex justify-center items-center">
                        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const MoreOptionsScreen = ({ onNavigate }) => {
    return (
        <div className="animate-in slide-in-from-right-4">
            <h2 className="text-2xl font-black text-[#001D3D] dark:text-white mb-6">More Options</h2>

            <div className="space-y-4">
                <button onClick={() => onNavigate('b2b_assistant')} className="w-full bg-gradient-to-r from-[#001D3D] to-[#1B5E20] border border-transparent rounded-2xl p-4 flex items-center justify-between shadow-lg hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-white">B2B AI Assistant</h4>
                            <p className="text-xs text-emerald-100">Smart Chat & Semantic DB Search</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-100" />
                </button>

                <button onClick={() => onNavigate('analytics')} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-[#001D3D] dark:text-white">Analytical View</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Sales trends & insights</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </button>

                <button onClick={() => onNavigate('sales_sheet')} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-[#001D3D] dark:text-white">Daily Sales Sheet</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Export PDF/Excel/CSV</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </button>

                <button onClick={() => onNavigate('profile')} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <UserCircle2 className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-[#001D3D] dark:text-white">Account Profile</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Manage password & settings</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </button>

                <button onClick={() => onNavigate('discounts')} className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:scale-[1.02] transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Percent className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-[#001D3D] dark:text-white">Smart Discounts</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">1-click expiry markdowns</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </button>
            </div>
        </div>
    );
};

const B2BAssistantScreen = ({ onBack }) => {
    const [subTab, setSubTab] = useState('chat');
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([{ role: 'bot', text: 'Hi! I am the PantryPal B2B Wholesale Assistant. Ask me about policies, bulk orders, or shipping!' }]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        const msg = query.trim();
        setQuery('');
        setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
        setLoading(true);
        try {
            const apiKey = localStorage.getItem('pantryGeminiKey');
            const res = await fetcher('/ai/b2b-chat', { method: 'POST', body: JSON.stringify({ message: msg, apiKey }) });
            if (res && res.answer) {
                setChatHistory(prev => [...prev, { role: 'bot', text: res.answer }]);
            } else {
                setChatHistory(prev => [...prev, { role: 'bot', text: res?.error || 'Sorry, I encountered an error connecting to the intelligence database.' }]);
            }
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'bot', text: 'Error reaching AI service.' }]);
        }
        setLoading(false);
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await fetcher(`/ai/semantic-search?query=${encodeURIComponent(query)}`);
            if (res && res.results) {
                setSearchResults(res.results);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="animate-in fade-in pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all duration-200"><ArrowLeft className="w-6 h-6 text-[#001D3D]" /></button>
                <h1 className="text-2xl font-black text-[#001D3D]">B2B AI Assistant</h1>
            </div>
            
            <div className="flex gap-2 mb-6">
                <button onClick={() => setSubTab('chat')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${subTab === 'chat' ? 'bg-[#001D3D] text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>RAG Chatbot</button>
                <button onClick={() => setSubTab('search')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${subTab === 'search' ? 'bg-[#001D3D] text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Semantic Search</button>
            </div>

            {subTab === 'chat' && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-[60vh] overflow-hidden">
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'bot' ? 'items-start' : 'items-start flex-row-reverse'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'bot' ? 'bg-[#001D3D] text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {msg.role === 'bot' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm ${msg.role === 'bot' ? 'bg-slate-100 text-slate-800 rounded-tl-none' : 'bg-emerald-500 text-white rounded-tr-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-3 items-start">
                                <div className="w-8 h-8 rounded-full bg-[#001D3D] text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
                                <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-500 rounded-tl-none text-sm animate-pulse">Thinking...</div>
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                        <VoiceInputButton onResult={(text) => setQuery(prev => prev ? prev + ' ' + text : text)} />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask about policies, shipping..." className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#001D3D]" />
                        <button type="submit" disabled={loading || !query.trim()} className="bg-[#001D3D] text-white p-3 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-colors"><MessageSquare className="w-5 h-5" /></button>
                    </form>
                </div>
            )}

            {subTab === 'search' && (
                <div className="space-y-4">
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="E.g., 'Heart healthy breakfast'" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#001D3D] shadow-sm" />
                        <button type="submit" disabled={loading || !query.trim()} className="bg-[#001D3D] text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 shadow-sm flex items-center gap-2">
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
                        </button>
                    </form>

                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/50 rounded-2xl p-4 text-xs text-indigo-800 text-center">
                        <strong>Semantic Search:</strong> Searching by meaning instead of exact keywords. Powered by Gemini text-embeddings and Endee Vector Database.
                    </div>

                    <div className="space-y-3 mt-6">
                        {searchResults.length === 0 && !loading && (
                            <div className="text-center py-10 opacity-60">
                                <Search className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                                <p className="font-bold text-slate-500">Search products by meaning.</p>
                            </div>
                        )}
                        {searchResults.map((res, i) => (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4 animate-in slide-up">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0"><Package className="w-5 h-5" /></div>
                                <div>
                                    <p className="font-medium text-[#001D3D] text-sm">{res.text}</p>
                                    <p className="text-xs text-indigo-500 font-bold mt-2">Similarity Score: {(res.logic_score * 100).toFixed(1)}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MULTI-LANGUAGE WIDGET ---
const LanguageSwitcher = () => {
    useEffect(() => {
        const scriptId = 'google-translate-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            script.async = true;
            document.body.appendChild(script);

            window.googleTranslateElementInit = () => {
                new window.google.translate.TranslateElement({
                    pageLanguage: 'en',
                    includedLanguages: 'kn,en,hi,te,ml',
                    layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                }, 'google_translate_element_react');
            };
        } else if (window.google?.translate) {
            // Document already has script, try re-initializing if element was unmounted
            if (document.getElementById('google_translate_element_react').innerHTML === '') {
                new window.google.translate.TranslateElement({
                    pageLanguage: 'en',
                    includedLanguages: 'kn,en,hi,te,ml',
                    layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                }, 'google_translate_element_react');
            }
        }
    }, []);

    return <div id="google_translate_element_react" className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-700 min-h-[35px] min-w-[120px]"></div>;
};

const App = () => {

    // Theme State (3-way: light, dark, system)
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('pantryTheme') || 'system';
    });

    // Handle OS preference matching and actual DOM application
    useEffect(() => {
        const root = document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = (mode) => {
            if (mode === 'dark' || (mode === 'system' && mediaQuery.matches)) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        applyTheme(theme);
        localStorage.setItem('pantryTheme', theme);

        const handleChange = () => { if (theme === 'system') applyTheme('system'); };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'system';
            return 'light';
        });
    };

    const ThemeIcon = () => {
        if (theme === 'light') return <Monitor className="w-5 h-5 text-emerald-500" />;
        if (theme === 'dark') return <Lightbulb className="w-5 h-5 text-amber-400" />;
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />; // System default
    };

    // Always start at login screen (no auto-login on refresh/open)
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [inventory, setInventory] = useState([]);
    const [salesToday, setSalesToday] = useState(0);
    const [showLoginNotify, setShowLoginNotify] = useState(true);
    const [isMobileView, setIsMobileView] = useState(false);

    const refresh = async () => {
        try {
            const data = await fetcher('/inventory');
            if (Array.isArray(data)) {
                setInventory(data);
            } else {
                setInventory([]);
            }
        } catch (e) {
            setInventory([]);
        }
    };

    const refreshSalesStats = async () => {
        if (user?.role === 'RETAILER') {
            const stats = await fetcher('/sales/stats');
            if (stats?.todayTotal != null) setSalesToday(stats.todayTotal);
        }
    };

    const handleSaleComplete = async (delta) => {
        if (user?.role === 'RETAILER') {
            const d = Number(delta);
            if (!Number.isNaN(d) && Number.isFinite(d) && d > 0) {
                setSalesToday(prev => Number(prev || 0) + d);
            }
            await refreshSalesStats();
        }
    };

    useEffect(() => {
        if (user) {
            refresh();
            refreshSalesStats();
            const interval = setInterval(() => { refresh(); refreshSalesStats(); }, 5000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const handleLogout = () => { localStorage.clear(); setUser(null); setShowLoginNotify(true); };
    const nearExpiry = Array.isArray(inventory) ? inventory.filter(i => i.finalDiscount > 0 || i.expiryStatus === 'urgent') : [];

    if (!user) return <AuthPage onAuthSuccess={setUser} />;

    if (user.role === 'CUSTOMER') return (
        <ThemeContext.Provider value={{ mode: theme, toggleMode: toggleTheme }}>
            <div className={`transition-all duration-300 ${theme === 'dark' ? 'dark' : ''} ${isMobileView ? "max-w-md mx-auto min-h-[90vh] my-8 rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden relative bg-white ring-4 ring-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:ring-slate-800" : "w-full min-h-screen bg-slate-50 dark:bg-slate-950 relative"}`}>
                <div className="absolute top-6 left-6 z-[200]">
                    <LanguageSwitcher />
                </div>
                <button onClick={toggleTheme} className="absolute top-6 right-6 z-[100] w-10 h-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm hover:scale-105 transition-all" title="Toggle Theme (Light/Dark/System)">
                    <ThemeIcon />
                </button>
                {showLoginNotify && nearExpiry.length > 0 && <LoginNotification items={nearExpiry} userRole={user.role} onDismiss={() => setShowLoginNotify(false)} />}
                <CustomerApp user={user} inventory={inventory} onLogout={handleLogout} refresh={refresh} />
                <button onClick={() => setIsMobileView(!isMobileView)} className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all outline-none border-2 border-slate-700/50 flex items-center justify-center gap-2" title="Toggle Device View">{isMobileView ? <><Monitor className="w-5 h-5" /> Desktop View</> : <><Smartphone className="w-5 h-5" /> Mobile View</>}</button>
            </div>
        </ThemeContext.Provider>
    );

    return (
        <ThemeContext.Provider value={{ mode: theme, toggleMode: toggleTheme }}>
            <div className={`min-h-screen transition-colors duration-500 font-sans text-[#001D3D] dark:text-slate-100 ${theme === 'dark' ? 'dark' : ''} ${isMobileView ? 'bg-slate-200/50 dark:bg-slate-950/80 py-4 sm:py-8 flex items-center justify-center' : 'bg-gradient-to-br from-slate-50 via-emerald-50/10 to-slate-100/90 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-900 flex justify-center'}`}>
                {showLoginNotify && nearExpiry.length > 0 && <LoginNotification items={nearExpiry} userRole={user.role} onDismiss={() => setShowLoginNotify(false)} />}
                <div className={`transition-all duration-500 w-full relative flex flex-col ${isMobileView ? "max-w-md h-[95vh] sm:h-[88vh] bg-white dark:bg-slate-900 rounded-[3rem] border-8 border-slate-900 shadow-2xl ring-4 ring-slate-100/50 dark:ring-slate-800/50 overflow-hidden" : "max-w-md bg-white/60 dark:bg-slate-900/80 backdrop-blur-2xl min-h-[100dvh] shadow-2xl shadow-slate-300/30 dark:shadow-slate-950/50 border-x border-slate-100/50 dark:border-slate-800"}`}>
                    <div className="p-6 pb-4 border-b border-transparent flex justify-between items-center glassy-card dark:bg-slate-800/80 sticky top-0 z-30 rounded-b-[2rem] mx-2 mt-2 shadow-sm">
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-gradient-to-br from-[#1B5E20] to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20"><Leaf className="w-5 h-5 text-white" /></div><span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#001D3D] to-[#1B5E20] dark:from-emerald-400 dark:to-emerald-600">PantryPal+</span></div>
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:block">
                                <LanguageSwitcher />
                            </div>
                            <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-emerald-500 transition-colors" title={`Theme: ${theme.toUpperCase()}`}>
                                <ThemeIcon />
                            </button>
                            <button onClick={handleLogout} className="p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors"><LogOut className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <main className="flex-1 overflow-y-auto p-6 pb-32 scrollbar-hide">
                        {activeTab === 'dashboard' && <RetailerDashboard inventory={inventory} user={user} onNavigate={setActiveTab} salesToday={salesToday} />}
                        {activeTab === 'add_stock' && <AddStockScreen onBack={() => setActiveTab('dashboard')} refresh={refresh} />}
                        {activeTab === 'ledger' && <ProductsScreen inventory={inventory} onBack={() => setActiveTab('dashboard')} refresh={refresh} />}
                        {activeTab === 'sales' && <SalesScreen onBack={() => setActiveTab('dashboard')} inventory={inventory} onSaleComplete={handleSaleComplete} />}
                        {activeTab === 'discounts' && <DiscountsScreen inventory={inventory} onBack={() => setActiveTab('dashboard')} />}

                        {/* New Phase 7 Tabs */}
                        {activeTab === 'more' && <MoreOptionsScreen onNavigate={setActiveTab} />}
                        {activeTab === 'analytics' && <AnalyticsDashboard onBack={() => setActiveTab('more')} />}
                        {activeTab === 'sales_sheet' && <DailySalesSheet onBack={() => setActiveTab('more')} />}
                        {activeTab === 'profile' && <ProfileScreen user={user} onBack={() => setActiveTab('more')} onUserUpdate={setUser} />}
                        {activeTab === 'b2b_assistant' && <B2BAssistantScreen onBack={() => setActiveTab('more')} />}
                    </main>
                    <div className="absolute bottom-0 w-full glassy-card dark:bg-slate-800/90 px-4 py-6 flex justify-around rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] dark:shadow-slate-950/50 z-50">
                        <NavIcon icon={LayoutDashboard} label="Dash" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                        <NavIcon icon={Package} label="Products" active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} />
                        <div className="-mt-10 mx-2 hover-lift">
                            <button onClick={() => setActiveTab('add_stock')} className="w-14 h-14 bg-gradient-to-br from-[#001D3D] to-slate-800 dark:from-emerald-800 dark:to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/30 dark:shadow-emerald-900/50 font-bold">
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>
                        <NavIcon icon={ShoppingCart} label="Sales" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
                        <NavIcon icon={SlidersHorizontal} label="More" active={['more', 'analytics', 'sales_sheet', 'profile', 'discounts'].includes(activeTab)} onClick={() => setActiveTab('more')} />
                    </div>
                </div>
                <button onClick={() => setIsMobileView(!isMobileView)} className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all outline-none border border-slate-700/50 flex items-center gap-3 font-bold text-sm tracking-wide float-anim" title="Toggle Device View">{isMobileView ? <><Monitor className="w-5 h-5 text-emerald-400" /> Desktop View</> : <><Smartphone className="w-5 h-5 text-emerald-400" /> Mobile View</>}</button>
            </div>
        </ThemeContext.Provider>
    );
};

export default App;