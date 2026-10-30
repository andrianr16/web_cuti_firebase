import { useState, useEffect } from "react";
import { collection, query, where, doc, updateDoc, getDocs, onSnapshot, addDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function DashboardSpv() {
    const [antrean, setAntrean] = useState([]);
    const [riwayat, setRiwayat] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPabrik, setFilterPabrik] = useState("semua");
    const [filterDivisi, setFilterDivisi] = useState("semua");
    const [opsiDivisi, setOpsiDivisi] = useState([]);
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [modalDetail, setModalDetail] = useState({ isOpen: false, data: null });
    
    // State Pengajuan Cuti Pribadi SPV
    const [modalAjukan, setModalAjukan] = useState(false);
    const [formCuti, setFormCuti] = useState({ mulai: "", selesai: "", alamat: "", kontak: "", alasan: "" });
    const [estimasiHari, setEstimasiHari] = useState(0);
    const [holidays, setHolidays] = useState([]);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let unsubPending = null;
        let unsubRiwayat = null;

        const fetchData = async () => {
            setIsLoading(true);
            const user = auth.currentUser;
            if (!user) return navigate("/login");

            try {
                const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
                let spvData = null;
                if (!userDoc.empty) {
                    spvData = { id: userDoc.docs[0].id, ...userDoc.docs[0].data() };
                    setUserData(spvData);
                }

                // Ambil Hari Libur untuk kalkulasi cuti SPV
                const snapHolidays = await getDocs(collection(db, "holidays"));
                const holidaysData = [];
                snapHolidays.forEach((d) => holidaysData.push(d.data()));
                setHolidays(holidaysData);

                if (spvData && spvData.divisi) {
                    const qPending = query(collection(db, "cuti_requests"), where("status", "==", "pending_spv"), where("divisi", "==", spvData.divisi));
                    unsubPending = onSnapshot(qPending, (snapshot) => {
                        const dataPending = [];
                        snapshot.forEach((doc) => dataPending.push({ id: doc.id, ...doc.data() }));
                        dataPending.sort((a, b) => new Date(a.diajukan_pada) - new Date(b.diajukan_pada));
                        setAntrean(dataPending);
                    });

                    const qRiwayat = query(collection(db, "cuti_requests"), where("spv_id", "==", spvData.id));
                    unsubRiwayat = onSnapshot(qRiwayat, (snapshot) => {
                        const dataRiwayat = [];
                        const divSet = new Set();
                        snapshot.forEach((d) => {
                            const data = { id: d.id, ...d.data() };
                            dataRiwayat.push(data);
                            if (data.divisi) divSet.add(data.divisi);
                        });
                        dataRiwayat.sort((a, b) => new Date(b.spv_approved_at || b.diajukan_pada) - new Date(a.spv_approved_at || a.diajukan_pada));
                        setRiwayat(dataRiwayat);
                        setOpsiDivisi([...divSet].sort());
                    });
                }
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        return () => { if (unsubPending) unsubPending(); if (unsubRiwayat) unsubRiwayat(); };
    }, [navigate]);

    // Kalkulasi Hari Kerja untuk Cuti Pribadi
    useEffect(() => {
        if (formCuti.mulai && formCuti.selesai) {
            const start = new Date(formCuti.mulai);
            const end = new Date(formCuti.selesai);
            if (start > end) { setEstimasiHari(0); return; }

            let count = 0;
            let cur = new Date(start);
            while (cur <= end) {
                const dayOfWeek = cur.getDay(); 
                const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const isHoliday = holidays.find(h => h.tanggal === dateStr);
                    if (isHoliday) { if (isHoliday.jenis === 'cuti_bersama') count++; } 
                    else { count++; }
                }
                cur.setDate(cur.getDate() + 1);
            }
            setEstimasiHari(count);
        } else { setEstimasiHari(0); }
    }, [formCuti.mulai, formCuti.selesai, holidays]);

    const submitCutiPribadi = async (e) => {
        e.preventDefault();
        if (estimasiHari === 0) return alert("Rentang tanggal seluruhnya libur/akhir pekan!");
        if (estimasiHari > userData.sisa_cuti) return alert(`Sisa cuti Anda (${userData.sisa_cuti} hari) tidak cukup.`);
        
        try {
            await addDoc(collection(db, "cuti_requests"), {
                user_id: userData.id,
                nama_karyawan: userData.name,
                nip: userData.nip || "-",
                divisi: userData.divisi,
                jabatan: userData.jabatan || "-",
                pabrik: userData.pabrik || "-",
                tanggal_mulai: formCuti.mulai,
                tanggal_selesai: formCuti.selesai,
                jumlah_hari: estimasiHari,
                alamat_cuti: formCuti.alamat,
                kontak_darurat: formCuti.kontak,
                alasan: formCuti.alasan,
                ttd_karyawan: userData.signature_pad || null, // Otomatis pakai ttd profil
                status: "pending_hrd", // Bypass persetujuan SPV (langsung ke HRD)
                spv_id: userData.id,
                nama_spv: userData.name,
                ttd_spv: userData.signature_pad || null,
                spv_approved_at: new Date().toISOString(),
                diajukan_pada: new Date().toISOString()
            });
            alert("Cuti pribadi berhasil diajukan dan diteruskan ke HRD.");
            setModalAjukan(false);
            setFormCuti({ mulai: "", selesai: "", alamat: "", kontak: "", alasan: "" });
        } catch (error) {
            alert("Gagal mengajukan cuti.");
        }
    };

    const handleAcc = async (item) => {
        if (!window.confirm(`Teruskan pengajuan cuti ${item.nama_karyawan} ke HRD?`)) return;
        try {
            setModalDetail({ isOpen: false, data: null });
            await updateDoc(doc(db, "cuti_requests", item.id), {
                status: "pending_hrd",
                spv_id: userData.id,
                nama_spv: userData.name,
                ttd_spv: userData.signature_pad || null,
                spv_approved_at: new Date().toISOString()
            });
        } catch (error) {
            alert("Gagal memproses persetujuan.");
        }
    };

    const handleTolak = async (id) => {
        const alasan = prompt("Masukkan alasan penolakan Supervisor:");
        if (!alasan) return;
        try {
            setModalDetail({ isOpen: false, data: null });
            await updateDoc(doc(db, "cuti_requests", id), {
                status: "rejected_spv",
                catatan_spv: alasan,
                spv_id: userData.id,
                nama_spv: userData.name,
                spv_approved_at: new Date().toISOString()
            });
        } catch (error) {
            alert("Gagal menolak permohonan.");
        }
    };

    const riwayatTampil = riwayat.filter(item => {
        const matchSearch = item.nama_karyawan.toLowerCase().includes(searchQuery.toLowerCase()) || (item.nip && item.nip.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchPabrik = filterPabrik === "semua" || (item.pabrik && item.pabrik.toLowerCase() === filterPabrik.toLowerCase());
        const matchDivisi = filterDivisi === "semua" || item.divisi === filterDivisi;
        return matchSearch && matchPabrik && matchDivisi;
    });

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-10">
            {/* Header Utama SPV */}
            <div className="bg-white border-b px-8 flex justify-between items-center shadow-sm h-16 sticky top-0 z-50">
                <div className="flex items-center gap-8 h-full">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#84cc16] flex items-center justify-center text-white font-bold text-xs shadow-sm">LG</div>
                        <span className="font-bold text-gray-800 tracking-wide text-[10px] uppercase mt-2">Lestari Group</span>
                    </div>
                    <nav className="hidden md:flex h-full">
                        <Link to="/" className={`h-full flex items-center px-4 text-sm font-bold text-blue-700 border-b-[3px] border-blue-700`}>Persetujuan Cuti (SPV)</Link>
                    </nav>
                </div>
                <div className="relative">
                    <button onClick={() => document.getElementById('userMenu').classList.toggle('hidden')} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 focus:outline-none">
                        {userData ? userData.name : 'Loading...'} 
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    
                    <div id="userMenu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50">
                        <Link to="/profile" className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">Profile</Link>
                        <button onClick={() => { auth.signOut(); navigate("/login"); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">Log Out</button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="max-w-7xl mx-auto px-6 mt-8 space-y-6 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div><div className="h-32 bg-gray-200 rounded-xl w-full"></div>
                </div>
            ) : (
            <div className="max-w-7xl mx-auto px-6 mt-8 space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-wide">Dashboard Supervisor - Persetujuan Cuti</h1>
                        <p className="text-xs text-gray-500 mt-1">Sisa Kuota Cuti Anda: <strong className="text-blue-600">{userData?.sisa_cuti} Hari</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
                            Sistem Realtime
                        </div>
                        <button onClick={() => setModalAjukan(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm text-xs transition flex items-center gap-2">
                            📝 Ajukan Cuti Pribadi
                        </button>
                    </div>
                </div>

                {/* TABEL ANTREAN SPV */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📋</span>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Antrean Persetujuan Cuti (Divisi {userData?.divisi || "-"})</h3>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">{antrean.length} Menunggu</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-white border-b border-gray-100">
                                <tr className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="px-4 py-3 w-1/5">Karyawan</th><th className="px-4 py-3 w-[15%]">Periode</th><th className="px-4 py-3 w-1/4">Alasan Cuti</th><th className="px-4 py-3 w-[10%] text-center">TTD Pemohon</th><th className="px-4 py-3 w-[30%] text-center">Keputusan SPV</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {antrean.length === 0 ? (
                                    <tr><td colSpan="5" className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada permohonan cuti baru.</td></tr>
                                ) : (
                                    antrean.map((item) => (
                                        <tr key={item.id} className="hover:bg-blue-50/30 transition cursor-pointer" onClick={() => setModalDetail({ isOpen: true, data: item })}>
                                            <td className="px-4 py-3"><div className="font-bold text-gray-900 text-sm">{item.nama_karyawan}</div><div className="text-[10px] text-gray-500 mt-0.5">{item.nip ?? '-'}</div></td>
                                            <td className="px-4 py-3"><div className="font-semibold text-gray-800">{item.tanggal_mulai.split("-").reverse().join("/")}</div><div className="text-gray-500">s/d {item.tanggal_selesai.split("-").reverse().join("/")}</div><div className="font-bold text-blue-600 mt-0.5">{item.jumlah_hari} Hari</div></td>
                                            <td className="px-4 py-3"><div className="group inline-block max-w-[180px] overflow-hidden"><p className="truncate text-gray-700 font-medium group-hover:text-blue-600 transition">{item.alasan}</p></div></td>
                                            <td className="px-4 py-3 text-center">{item.ttd_karyawan ? <img src={item.ttd_karyawan} alt="TTD" className="h-7 mx-auto object-contain bg-white border rounded px-1" /> : '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-start justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleAcc(item); }} className="w-1/2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded transition">✓ ACC</button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleTolak(item.id); }} className="w-1/2 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold rounded transition">✕ Tolak</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FILTER DAN RIWAYAT SPV */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-6">
                    <div className="flex items-center justify-between border-b pb-2.5 mb-4">
                        <div className="flex items-center gap-2"><span className="text-blue-600">🔍</span><h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Cari & Filter Riwayat SPV</h3></div>
                        <button onClick={() => { setSearchQuery(""); setFilterPabrik("semua"); setFilterDivisi("semua"); }} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg transition">Reset Filter</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ketik nama / nip..." className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 p-2.5 outline-none" />
                        <select value={filterPabrik} onChange={e => setFilterPabrik(e.target.value)} className="w-full text-xs rounded-lg border border-gray-300 p-2.5 outline-none"><option value="semua">Semua Pabrik</option><option value="supra">Pabrik Supra</option><option value="joya">Pabrik Joya</option><option value="minyak">Pabrik Minyak</option><option value="seg">Pabrik SEG</option></select>
                        <select value={filterDivisi} onChange={e => setFilterDivisi(e.target.value)} className="w-full text-xs rounded-lg border border-gray-300 p-2.5 outline-none"><option value="semua">Semua Divisi</option>{opsiDivisi.map(div => <option key={div} value={div}>{div}</option>)}</select>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                        <span className="text-xl">📄</span><h3 className="text-base font-bold text-gray-900">Riwayat Keputusan & Pengajuan Anda</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-white border-b border-gray-100">
                                <tr className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="px-4 py-3 w-[15%]">Pegawai</th><th className="px-4 py-3 w-[15%]">Periode Cuti</th><th className="px-4 py-3 w-[10%] text-center">Durasi</th><th className="px-4 py-3 w-[25%]">Alasan</th><th className="px-4 py-3 w-[15%] text-center">Status</th><th className="px-4 py-3 w-[20%]">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {riwayatTampil.length === 0 ? (
                                    <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400 text-sm">Belum ada riwayat.</td></tr>
                                ) : (
                                    riwayatTampil.map((item) => (
                                        <tr key={item.id} className={`transition cursor-pointer ${item.user_id === userData?.id ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setModalDetail({ isOpen: true, data: item })}>
                                            <td className="px-4 py-3"><div className="font-bold text-gray-800 text-sm">{item.nama_karyawan}</div><div className="text-[10px] text-gray-500 mt-0.5">{item.user_id === userData?.id ? "(Pengajuan Pribadi)" : item.nip}</div></td>
                                            <td className="px-4 py-3 font-medium text-gray-700">{item.tanggal_mulai.split("-").reverse().join("/")} s.d {item.tanggal_selesai.split("-").reverse().join("/")}</td>
                                            <td className="px-4 py-3 text-center font-bold text-blue-600">{item.jumlah_hari} Hari</td>
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">{item.alasan}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.status === 'approved' ? <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">✓ ACC HRD</span> :
                                                 item.status === 'pending_hrd' ? <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">⏳ Cek HRD</span> :
                                                 item.status === 'rejected_spv' ? <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">✕ Ditolak SPV</span> :
                                                 <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">✕ Ditolak HRD</span>}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 italic max-w-[150px] truncate">{item.catatan_hrd || item.catatan_spv || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            {/* MODAL AJUKAN CUTI PRIBADI */}
            {modalAjukan && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-xl w-full animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Ajukan Cuti Pribadi</h3>
                            <button onClick={() => setModalAjukan(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>
                        <form onSubmit={submitCutiPribadi} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-semibold mb-1">Mulai Cuti</label><input type="date" required value={formCuti.mulai} onChange={e => setFormCuti({...formCuti, mulai: e.target.value})} className="w-full border p-2 rounded text-sm"/></div>
                                <div><label className="block text-xs font-semibold mb-1">Selesai Cuti</label><input type="date" required value={formCuti.selesai} onChange={e => setFormCuti({...formCuti, selesai: e.target.value})} className="w-full border p-2 rounded text-sm"/></div>
                            </div>
                            {formCuti.mulai && formCuti.selesai && (
                                <div className="p-2 bg-blue-50 text-blue-700 text-xs rounded font-semibold">Estimasi memotong kuota: {estimasiHari} Hari</div>
                            )}
                            <div><label className="block text-xs font-semibold mb-1">Alamat Cuti</label><input type="text" required value={formCuti.alamat} onChange={e => setFormCuti({...formCuti, alamat: e.target.value})} className="w-full border p-2 rounded text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Telepon / Kontak</label><input type="text" required value={formCuti.kontak} onChange={e => setFormCuti({...formCuti, kontak: e.target.value})} className="w-full border p-2 rounded text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Alasan Cuti</label><textarea required rows="2" value={formCuti.alasan} onChange={e => setFormCuti({...formCuti, alasan: e.target.value})} className="w-full border p-2 rounded text-sm"></textarea></div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setModalAjukan(false)} className="px-4 py-2 bg-gray-100 text-sm font-bold rounded">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded shadow-sm">Kirim ke HRD</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DETAIL CUTI */}
            {modalDetail.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalDetail({ isOpen: false, data: null })}>
                    <div className="bg-white rounded-xl shadow-2xl p-7 max-w-xl w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b pb-4 mb-5">
                            <div><h3 className="text-xl font-bold text-gray-900">Detail Permohonan Cuti</h3><p className="text-xs font-mono text-gray-500 mt-1">{modalDetail.data.nomor_surat || "Status: " + modalDetail.data.status.replace('_', ' ').toUpperCase()}</p></div>
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="text-gray-400 text-2xl font-bold leading-none">✕</button>
                        </div>
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Nama Pegawai</div><div className="col-span-2 font-bold">{modalDetail.data.nama_karyawan} ({modalDetail.data.nip || "-"})</div></div>
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Periode</div><div className="col-span-2 font-semibold">{modalDetail.data.tanggal_mulai.split("-").reverse().join("/")} s/d {modalDetail.data.tanggal_selesai.split("-").reverse().join("/")} <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{modalDetail.data.jumlah_hari} Hari Kerja</span></div></div>
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Alamat/Kontak</div><div className="col-span-2 leading-relaxed">{modalDetail.data.kontak_darurat}<br/><span className="text-xs text-gray-500">{modalDetail.data.alamat_cuti || "-"}</span></div></div>
                            <div className="grid grid-cols-1 gap-2 border-b border-gray-50 pb-4"><div className="text-gray-500 font-semibold mb-1">Alasan Lengkap:</div><div className="p-3 bg-gray-50 border border-gray-200 rounded-lg italic whitespace-pre-wrap">"{modalDetail.data.alasan}"</div></div>
                            {(modalDetail.data.catatan_spv || modalDetail.data.catatan_hrd) && (
                                <div className="grid grid-cols-1 gap-2 bg-gray-50 p-3 rounded-lg border"><div className="text-gray-700 font-semibold text-xs tracking-wider">Catatan:</div><div className="text-gray-900 font-medium">{modalDetail.data.catatan_hrd || modalDetail.data.catatan_spv}</div></div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            {modalDetail.data.status === 'pending_spv' && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); handleTolak(modalDetail.data.id); }} className="px-4 py-2 bg-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-200 transition">Tolak</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleAcc(modalDetail.data); }} className="px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition">ACC (Ke HRD)</button>
                                </>
                            )}
                            {/* Tombol Cetak PDF muncul jika dokumen sudah diapprove dan ini adalah dokumen SPV sendiri */}
                            {modalDetail.data.status === 'approved' && modalDetail.data.user_id === userData?.id && (
                                <button onClick={(e) => { e.stopPropagation(); window.open(`/cuti/${modalDetail.data.id}/print`, '_blank'); }} className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition">📄 Cetak PDF</button>
                            )}
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}