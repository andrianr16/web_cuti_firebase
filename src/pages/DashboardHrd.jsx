import { useState, useEffect } from "react";
import { collection, query, where, doc, updateDoc, getDoc, getDocs, onSnapshot, writeBatch, addDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function DashboardHrd() {
    const [antrean, setAntrean] = useState([]);
    const [riwayat, setRiwayat] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [exportFilters, setExportFilters] = useState({ tahun: new Date().getFullYear().toString(), bulan: "semua", pabrik: "semua", status: "semua" });
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [modalDetail, setModalDetail] = useState({ isOpen: false, data: null });
    
    // State Pengajuan Cuti Pribadi HRD
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
                if (!userDoc.empty) { setUserData({ id: userDoc.docs[0].id, ...userDoc.docs[0].data() }); }

                const snapHolidays = await getDocs(collection(db, "holidays"));
                const holidaysData = [];
                snapHolidays.forEach((d) => holidaysData.push(d.data()));
                setHolidays(holidaysData);

                // REALTIME LISTENER: Antrean (Menunggu HRD)
                const qPending = query(collection(db, "cuti_requests"), where("status", "==", "pending_hrd"));
                unsubPending = onSnapshot(qPending, async (snapshot) => {
                    const pendingPromises = snapshot.docs.map(async (d) => {
                        const item = { id: d.id, ...d.data() };
                        const uSnap = await getDoc(doc(db, "users", item.user_id));
                        if (uSnap.exists()) item.sisa_cuti = uSnap.data().sisa_cuti;
                        return item;
                    });
                    const resolvedPending = await Promise.all(pendingPromises);
                    resolvedPending.sort((a, b) => new Date(a.diajukan_pada) - new Date(b.diajukan_pada));
                    setAntrean(resolvedPending);
                });

                // REALTIME LISTENER: Riwayat Keputusan & Cuti Pribadi HRD
                const qRiwayat = query(collection(db, "cuti_requests"), where("status", "in", ["approved", "rejected", "rejected_spv"]));
                unsubRiwayat = onSnapshot(qRiwayat, (snapshot) => {
                    const dataRiwayat = [];
                    snapshot.forEach((d) => dataRiwayat.push({ id: d.id, ...d.data() }));
                    dataRiwayat.sort((a, b) => new Date(b.hrd_approved_at || b.diajukan_pada) - new Date(a.hrd_approved_at || a.diajukan_pada));
                    setRiwayat(dataRiwayat);
                });

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        return () => { if (unsubPending) unsubPending(); if (unsubRiwayat) unsubRiwayat(); };
    }, [navigate]);

    // Kalkulasi Hari Libur
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
            const newSisa = userData.sisa_cuti - estimasiHari;
            await updateDoc(doc(db, "users", userData.id), { sisa_cuti: newSisa });
            setUserData({...userData, sisa_cuti: newSisa});
            
            const formatNomorSurat = `CUTI/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/HRD-${Date.now().toString().slice(-4)}`;

            await addDoc(collection(db, "cuti_requests"), {
                user_id: userData.id,
                nama_karyawan: userData.name,
                nip: userData.nip || "-",
                divisi: userData.divisi || "Personalia HRD",
                jabatan: userData.jabatan || "Personalia HRD",
                pabrik: userData.pabrik || "-",
                tanggal_mulai: formCuti.mulai,
                tanggal_selesai: formCuti.selesai,
                jumlah_hari: estimasiHari,
                alamat_cuti: formCuti.alamat,
                kontak_darurat: formCuti.kontak,
                alasan: formCuti.alasan,
                ttd_karyawan: userData.signature_pad || null, // Auto dari profil (sebagai karyawan)
                status: "approved", // Otoritas penuh (langsung ACC)
                hrd_id: userData.id,
                nama_hrd: userData.name,
                ttd_hrd: userData.signature_pad || null, // Auto dari profil (sebagai approver)
                hrd_approved_at: new Date().toISOString(),
                nomor_surat: formatNomorSurat,
                diajukan_pada: new Date().toISOString()
            });
            
            alert("Cuti pribadi berhasil diajukan dan langsung disetujui (Dokumen Terbit).");
            setModalAjukan(false);
            setFormCuti({ mulai: "", selesai: "", alamat: "", kontak: "", alasan: "" });
        } catch (error) {
            alert("Gagal mengajukan cuti.");
        }
    };

    const handleAcc = async (item) => {
        if (!window.confirm(`Setujui cuti ${item.nama_karyawan} sejumlah ${item.jumlah_hari} hari?`)) return;
        try {
            setModalDetail({ isOpen: false, data: null });
            const userRef = doc(db, "users", item.user_id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const currentSisa = userSnap.data().sisa_cuti;
                await updateDoc(userRef, { sisa_cuti: currentSisa - item.jumlah_hari });
                
                const formatNomorSurat = `CUTI/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(item.id).substring(0,4).toUpperCase()}`;

                await updateDoc(doc(db, "cuti_requests", item.id), {
                    status: "approved",
                    hrd_id: userData.id,
                    nama_hrd: userData.name,
                    ttd_hrd: userData.signature_pad || null, 
                    hrd_approved_at: new Date().toISOString(),
                    nomor_surat: formatNomorSurat
                });
            }
        } catch (error) {
            alert("Gagal memproses persetujuan.");
        }
    };

    const handleTolak = async (id) => {
        const alasan = prompt("Masukkan alasan penolakan HRD:");
        if (!alasan) return;
        try {
            setModalDetail({ isOpen: false, data: null });
            await updateDoc(doc(db, "cuti_requests", id), {
                status: "rejected",
                catatan_hrd: alasan,
                hrd_id: userData.id,
                nama_hrd: userData.name,
                hrd_approved_at: new Date().toISOString()
            });
        } catch (error) {
            alert("Gagal menolak permohonan.");
        }
    };

    const handleSyncLibur = async () => {
        const tahun = new Date().getFullYear();
        if (!window.confirm(`Tarik data libur nasional & cuti bersama tahun ${tahun}?`)) return;
        try {
            const liburInternal = [
                { tanggal: "2026-01-01", keterangan: "Tahun Baru Masehi", jenis: "libur_nasional" },
                { tanggal: "2026-02-17", keterangan: "Isra Mikraj Nabi Muhammad SAW", jenis: "libur_nasional" },
                { tanggal: "2026-03-03", keterangan: "Hari Suci Nyepi", jenis: "libur_nasional" },
                { tanggal: "2026-03-20", keterangan: "Cuti Bersama Idul Fitri", jenis: "cuti_bersama" },
                { tanggal: "2026-03-21", keterangan: "Hari Raya Idul Fitri", jenis: "libur_nasional" },
                { tanggal: "2026-03-22", keterangan: "Hari Raya Idul Fitri", jenis: "libur_nasional" },
                { tanggal: "2026-03-23", keterangan: "Cuti Bersama Idul Fitri", jenis: "cuti_bersama" }
            ];
            const batch = writeBatch(db);
            let count = 0;
            liburInternal.forEach((item) => {
                const docRef = doc(db, "holidays", item.tanggal);
                batch.set(docRef, item);
                count++;
            });
            await batch.commit();
            alert(`Berhasil! Total ${count} hari libur disinkronkan.`);
        } catch (error) {
            alert("Gagal menyinkronkan libur.");
        }
    };

    const handleExportCSV = () => {
        const BOM = "\uFEFF";
        const headers = ["No;Nomor Surat;NIP;Nama Karyawan;Divisi;Pabrik;Periode Cuti;Durasi;Alasan;Status Keputusan;Catatan HRD"];
        let filteredRiwayat = riwayat;

        if (exportFilters.status !== 'semua') filteredRiwayat = filteredRiwayat.filter(k => k.status === exportFilters.status);
        if (exportFilters.pabrik !== 'semua') filteredRiwayat = filteredRiwayat.filter(k => k.pabrik?.toLowerCase() === exportFilters.pabrik);
        if (exportFilters.tahun !== 'semua') filteredRiwayat = filteredRiwayat.filter(k => new Date(k.tanggal_mulai).getFullYear().toString() === exportFilters.tahun);
        if (exportFilters.bulan !== 'semua') filteredRiwayat = filteredRiwayat.filter(k => (new Date(k.tanggal_mulai).getMonth() + 1).toString() === exportFilters.bulan);

        const rows = filteredRiwayat.map((k, index) => {
            const no = index + 1;
            const noSurat = `"${k.nomor_surat || "-"}"`;
            const nip = `='${k.nip || "-"}'`; 
            const nama = `"${k.nama_karyawan}"`;
            const divisi = `"${k.divisi || "-"}"`;
            const pabrik = `"${(k.pabrik || "-").toUpperCase()}"`;
            const periode = `"${k.tanggal_mulai.split("-").reverse().join("/")} s/d ${k.tanggal_selesai.split("-").reverse().join("/")}"`;
            const durasi = `"${k.jumlah_hari} Hari"`;
            const alasan = `"${k.alasan.replace(/\n/g, " ")}"`; 
            const status = `"${k.status}"`;
            const catatan = `"${k.catatan_hrd || k.catatan_spv || "-"}"`;
            return `${no};${noSurat};${nip};${nama};${divisi};${pabrik};${periode};${durasi};${alasan};${status};${catatan}`;
        });

        const csvContent = BOM + headers.concat(rows).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Rekap_Cuti_HRD_${exportFilters.tahun}_Bulan_${exportFilters.bulan}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const riwayatTampil = riwayat.filter(item => 
        item.nama_karyawan.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.nip && item.nip.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.nomor_surat && item.nomor_surat.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-10">
            {/* Header Utama HRD */}
            <div className="bg-white border-b px-8 flex justify-between items-center shadow-sm h-16 sticky top-0 z-50">
                <div className="flex items-center gap-8 h-full">
                    <div className="flex items-center">
                        <img 
                            src="/logo.png" 
                            alt="Logo Lestari Group" 
                            className="h-9 object-contain" 
                            onError={(e) => { e.target.outerHTML = '<span class="font-bold text-gray-800 tracking-wide text-[12px] uppercase">LESTARI GROUP</span>'; }}
                        />
                    </div>
                    <nav className="hidden md:flex h-full">
                        <Link to="/" className={`h-full flex items-center px-4 text-sm ${location.pathname === '/' ? 'font-bold text-blue-700 border-b-[3px] border-blue-700' : 'font-medium text-gray-500 hover:text-blue-600'}`}>Kelola Cuti (HRD)</Link>
                        <Link to="/hrd/karyawan" className={`h-full flex items-center px-4 text-sm ${location.pathname.includes('/karyawan') ? 'font-bold text-blue-700 border-b-[3px] border-blue-700' : 'font-medium text-gray-500 hover:text-blue-600'}`}>Monitoring Pabrik & Karyawan</Link>
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
                        <h1 className="text-xl font-bold text-gray-900 tracking-wide">Persetujuan Cuti Karyawan (HRD)</h1>
                        <p className="text-xs text-gray-500 mt-1">Sisa Kuota Cuti Anda: <strong className="text-blue-600">{userData?.sisa_cuti} Hari</strong></p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
                            Sistem Realtime
                        </div>
                        <button onClick={handleSyncLibur} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg shadow-sm text-xs transition flex items-center gap-2">
                            📅 Sinkron Libur
                        </button>
                        <button onClick={() => setModalAjukan(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm text-xs transition flex items-center gap-2">
                            📝 Ajukan Cuti Pribadi
                        </button>
                    </div>
                </div>

                {/* TABEL ANTREAN HRD */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/80">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="text-base">📋</span>
                        <h2 className="text-sm font-bold text-gray-900">Permohonan Masuk Menunggu Persetujuan HRD</h2>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">{antrean.length} Menunggu</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50/80 border-y border-gray-100">
                                <tr className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    <th className="p-4 w-[20%]">Pegawai</th><th className="p-4 w-[10%] text-center">Sisa Cuti</th><th className="p-4 w-[15%]">Periode Cuti</th><th className="p-4 w-[20%]">Alasan</th><th className="p-4 w-[10%] text-center">TTD Pegawai</th><th className="p-4 w-[10%] text-center">Persetujuan SPV</th><th className="p-4 w-[15%] text-center">Aksi HRD</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {antrean.length === 0 ? (
                                    <tr><td colSpan="7" className="py-12 text-center text-sm text-gray-400">Tidak ada pengajuan cuti yang menunggu peninjauan HRD.</td></tr>
                                ) : (
                                    antrean.map((item) => (
                                        <tr key={item.id} className="hover:bg-blue-50/40 cursor-pointer transition" onClick={() => setModalDetail({ isOpen: true, data: item })}>
                                            <td className="p-4"><div className="font-bold text-gray-900 text-xs">{item.nama_karyawan}</div><div className="text-[10px] text-gray-500 mt-0.5">NIP: {item.nip}</div></td>
                                            <td className="p-4 text-center font-bold text-blue-600 text-xs">{item.sisa_cuti ?? '-'} Hari</td>
                                            <td className="p-4 text-xs font-semibold text-gray-800">{item.tanggal_mulai.split("-").reverse().join("/")} s.d {item.tanggal_selesai.split("-").reverse().join("/")}</td>
                                            <td className="p-4 text-[11px] text-gray-600 max-w-[150px] truncate" title={item.alasan}>{item.alasan}</td>
                                            <td className="p-4 text-center">{item.ttd_karyawan ? <img src={item.ttd_karyawan} alt="TTD" className="h-6 mx-auto object-contain" /> : '-'}</td>
                                            <td className="p-4 text-center">{item.ttd_spv ? <img src={item.ttd_spv} alt="TTD SPV" className="h-6 mx-auto object-contain" /> : '-'}</td>
                                            <td className="p-4 text-center space-x-2 whitespace-nowrap">
                                                <button onClick={(e) => { e.stopPropagation(); handleAcc(item); }} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded shadow-sm">ACC</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleTolak(item.id); }} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-[10px] font-bold rounded">Tolak</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PANEL EKSPOR */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/80 mt-6">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">EKSPOR REKAPITULASI DATA CUTI</h3>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs text-gray-600 mb-1.5">Tahun</label><select value={exportFilters.tahun} onChange={(e) => setExportFilters({...exportFilters, tahun: e.target.value})} className="w-full text-xs border-gray-300 rounded-lg p-2.5 border outline-none"><option value="semua">Semua Tahun</option><option value="2026">2026</option><option value="2027">2027</option></select></div>
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs text-gray-600 mb-1.5">Bulan</label><select value={exportFilters.bulan} onChange={(e) => setExportFilters({...exportFilters, bulan: e.target.value})} className="w-full text-xs border-gray-300 rounded-lg p-2.5 border outline-none"><option value="semua">Semua Bulan (1 Tahun Penuh)</option>{[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'long'})}</option>)}</select></div>
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs text-gray-600 mb-1.5">Pabrik</label><select value={exportFilters.pabrik} onChange={(e) => setExportFilters({...exportFilters, pabrik: e.target.value})} className="w-full text-xs border-gray-300 rounded-lg p-2.5 border outline-none"><option value="semua">Semua Pabrik</option><option value="supra">Supra</option><option value="joya">Joya</option><option value="minyak">Minyak</option><option value="seg">SEG</option></select></div>
                        <div className="flex-1 min-w-[150px]"><label className="block text-xs text-gray-600 mb-1.5">Status</label><select value={exportFilters.status} onChange={(e) => setExportFilters({...exportFilters, status: e.target.value})} className="w-full text-xs border-gray-300 rounded-lg p-2.5 border outline-none"><option value="semua">Semua Status</option><option value="approved">Disetujui</option><option value="rejected">Ditolak HRD</option><option value="rejected_spv">Ditolak SPV</option></select></div>
                        <div><button onClick={handleExportCSV} className="bg-[#059669] hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition">⬇ Unduh Laporan</button></div>
                    </div>
                </div>

                <div className="relative w-full max-w-sm mt-6">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" placeholder="Cari nama / NIP / No. Surat..." className="w-full pl-9 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:ring-blue-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                </div>

                {/* TABEL RIWAYAT GLOBAL */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/80 mt-6">
                    <div className="flex items-center gap-2 mb-6"><span className="text-base">📄</span><h2 className="text-sm font-bold text-gray-900">Riwayat Keputusan Cuti (Global)</h2></div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50/80 border-y border-gray-100">
                                <tr className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    <th className="p-4 w-[15%]">Pegawai</th><th className="p-4 w-[20%]">Periode Cuti</th><th className="p-4 w-[10%]">Durasi</th><th className="p-4 w-[20%]">Alasan</th><th className="p-4 w-[10%] text-center">Status Keputusan</th><th className="p-4 w-[15%]">Catatan</th><th className="p-4 w-[10%] text-center">No. Surat / Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {riwayatTampil.length === 0 ? (
                                    <tr><td colSpan="7" className="py-8 text-center text-gray-400 text-xs">Belum ada riwayat.</td></tr>
                                ) : (
                                    riwayatTampil.map((item) => (
                                        <tr key={item.id} className={`transition cursor-pointer ${item.user_id === userData?.id ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setModalDetail({ isOpen: true, data: item })}>
                                            <td className="p-4"><div className="font-bold text-gray-800 text-xs">{item.nama_karyawan}</div><div className="text-[10px] text-gray-500 mt-0.5">{item.user_id === userData?.id ? "(Pengajuan Pribadi)" : item.nip}</div></td>
                                            <td className="p-4 text-xs font-medium text-gray-600">{item.tanggal_mulai.split("-").reverse().join("/")} s.d {item.tanggal_selesai.split("-").reverse().join("/")}</td>
                                            <td className="p-4 font-bold text-blue-600 text-xs">{item.jumlah_hari} Hari</td>
                                            <td className="p-4 text-xs text-gray-600 truncate max-w-[150px]" title={item.alasan}>{item.alasan}</td>
                                            <td className="p-4 text-center">
                                                {item.status === 'approved' ? <span className="px-2.5 py-1 bg-[#dcfce7] text-[#166534] text-[10px] font-bold rounded">✓ Disetujui HRD</span> :
                                                 item.status === 'rejected_spv' ? <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">✕ Ditolak SPV</span> :
                                                 <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded">✕ Ditolak HRD</span>}
                                            </td>
                                            <td className="p-4 text-xs text-emerald-600 font-medium truncate max-w-[150px]">{item.catatan_hrd || item.catatan_spv || (item.status === 'approved' ? "Disetujui" : "-")}</td>
                                            <td className="p-4 text-center">
                                                <div className="text-[10px] font-mono text-gray-500 mb-1 font-bold">{item.nomor_surat || '-'}</div>
                                                {item.status === 'approved' && (
                                                    <button onClick={(e) => { e.stopPropagation(); window.open(`/cuti/${item.id}/print`, '_blank'); }} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded shadow-sm hover:bg-blue-100 transition mx-auto">📄 Cetak PDF</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            {/* MODAL AJUKAN CUTI PRIBADI HRD */}
            {modalAjukan && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-xl w-full animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Ajukan Cuti Pribadi (HRD)</h3>
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
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded shadow-sm">Terbitkan Surat Cuti</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DETAIL CUTI HRD */}
            {modalDetail.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalDetail({ isOpen: false, data: null })}>
                    <div className="bg-white rounded-xl shadow-2xl p-7 max-w-xl w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b pb-4 mb-5">
                            <div><h3 className="text-xl font-bold text-gray-900">Detail Permohonan Cuti</h3><p className="text-xs font-mono text-gray-500 mt-1">{modalDetail.data.nomor_surat || "Status: " + modalDetail.data.status.replace('_', ' ').toUpperCase()}</p></div>
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">✕</button>
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
                            {modalDetail.data.status === 'pending_hrd' && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); handleTolak(modalDetail.data.id); }} className="px-4 py-2 bg-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-200 transition">Tolak</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleAcc(modalDetail.data); }} className="px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition">ACC Cuti</button>
                                </>
                            )}
                            {/* Tombol Cetak PDF muncul jika ini adalah permohonan pribadi milik HRD ini atau diapprove */}
                            {modalDetail.data.status === 'approved' && (
                                <button onClick={(e) => { e.stopPropagation(); window.open(`/cuti/${modalDetail.data.id}/print`, '_blank'); }} className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition">📄 Cetak PDF</button>
                            )}
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}