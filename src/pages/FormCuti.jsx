import { useState, useEffect, useRef } from "react";
import { collection, addDoc, doc, getDoc, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";

export default function FormCuti() {
    const [userData, setUserData] = useState(null);
    const [riwayat, setRiwayat] = useState([]);
    const [holidays, setHolidays] = useState([]);
    
    // Modal Detail Permohonan
    const [modalDetail, setModalDetail] = useState({ isOpen: false, data: null });

    const [mulai, setMulai] = useState("");
    const [selesai, setSelesai] = useState("");
    const [alamat, setAlamat] = useState("");
    const [kontak, setKontak] = useState("");
    const [alasan, setAlasan] = useState("");
    const [estimasiHari, setEstimasiHari] = useState(0);
    
    const sigCanvas = useRef({});
    const navigate = useNavigate();

    useEffect(() => {
        let unsubRiwayat = null;

        const fetchData = async () => {
            const user = auth.currentUser;
            if (!user) {
                navigate("/login");
                return;
            }

            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                setUserData({ id: user.uid, ...userDoc.data() });
            }

            // Ambil Data Hari Libur
            const snapHolidays = await getDocs(collection(db, "holidays"));
            const holidaysData = [];
            snapHolidays.forEach((doc) => holidaysData.push(doc.data()));
            setHolidays(holidaysData);

            // REALTIME LISTENER: Riwayat Cuti Pribadi Karyawan
            const qRiwayat = query(collection(db, "cuti_requests"), where("user_id", "==", user.uid));
            unsubRiwayat = onSnapshot(qRiwayat, (snapshot) => {
                const riwayatData = [];
                snapshot.forEach((doc) => riwayatData.push({ id: doc.id, ...doc.data() }));
                riwayatData.sort((a, b) => new Date(b.diajukan_pada) - new Date(a.diajukan_pada));
                setRiwayat(riwayatData);
            });
        };

        fetchData();

        return () => {
            if (unsubRiwayat) unsubRiwayat();
        };
    }, [navigate]);

    useEffect(() => {
        if (mulai && selesai) {
            const start = new Date(mulai);
            const end = new Date(selesai);
            
            if (start > end) {
                setEstimasiHari(0);
                return;
            }

            let count = 0;
            let cur = new Date(start);

            while (cur <= end) {
                const dayOfWeek = cur.getDay(); 
                const yyyy = cur.getFullYear();
                const mm = String(cur.getMonth() + 1).padStart(2, '0');
                const dd = String(cur.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;

                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    const isHoliday = holidays.find(h => h.tanggal === dateStr);
                    if (isHoliday) {
                        if (isHoliday.jenis === 'cuti_bersama') count++;
                    } else {
                        count++;
                    }
                }
                cur.setDate(cur.getDate() + 1);
            }
            setEstimasiHari(count);
        } else {
            setEstimasiHari(0);
        }
    }, [mulai, selesai, holidays]);

    const submitCuti = async (e) => {
        e.preventDefault();
        
        if (sigCanvas.current.isEmpty()) {
            return alert("Silakan bubuhkan tanda tangan pemohon di dalam kotak yang disediakan.");
        }
        if (estimasiHari === 0) return alert("Rentang tanggal seluruhnya adalah hari libur atau akhir pekan!");
        if (estimasiHari > userData.sisa_cuti) return alert(`Gagal! Pengajuan ini butuh ${estimasiHari} hari, sisa cuti Anda hanya ${userData.sisa_cuti} hari.`);

        try {
            const canvasElement = sigCanvas.current.getCanvas();
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasElement.width;
            tempCanvas.height = canvasElement.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(canvasElement, 0, 0);
            const ttdGambar = tempCanvas.toDataURL("image/jpeg", 0.5);

            await addDoc(collection(db, "cuti_requests"), {
                user_id: userData.id,
                nama_karyawan: userData.name,
                nip: userData.nip || "-",
                divisi: userData.divisi,
                jabatan: userData.jabatan || "-",
                pabrik: userData.pabrik || "-",
                tanggal_mulai: mulai,
                tanggal_selesai: selesai,
                jumlah_hari: estimasiHari,
                alamat_cuti: alamat,
                kontak_darurat: kontak,
                alasan: alasan,
                ttd_karyawan: ttdGambar, 
                status: "pending_spv",
                diajukan_pada: new Date().toISOString()
            });
            
            // Pembersihan Form Manual Tanpa Refresh Halaman
            alert(`Berhasil! Cuti sebanyak ${estimasiHari} hari dikirim ke Supervisor.`);
            setMulai("");
            setSelesai("");
            setAlamat("");
            setKontak("");
            setAlasan("");
            setEstimasiHari(0);
            sigCanvas.current.clear();
            
        } catch (error) {
            alert("Gagal menyimpan data. Cek koneksi Anda.");
            console.error(error);
        }
    };

    if (!userData) return <div className="p-10 text-center font-semibold text-gray-600">Memuat data...</div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            {/* Header / Navbar */}
            <div className="bg-white border-b px-8 flex justify-between items-center shadow-sm h-16 sticky top-0 z-50">
                <div className="flex items-center gap-4 h-full">
                    <div className="w-8 h-8 bg-[#84cc16] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">LG</div>
                    <div className="h-full flex items-center border-b-[3px] border-blue-600 px-2 text-sm font-semibold text-blue-700 tracking-wide mt-0.5">
                        Permohonan Cuti
                    </div>
                </div>
                
                <div className="relative">
                    <button onClick={() => document.getElementById('karyawanMenu').classList.toggle('hidden')} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 focus:outline-none">
                        {userData.name} ▼
                    </button>
                    <div id="karyawanMenu" className="hidden absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50">
                        <button onClick={() => auth.signOut()} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition font-bold">
                            Log Out
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 mt-8 space-y-8">
                
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">Formulir Pengajuan Cuti Karyawan</h1>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        Sistem Update Realtime
                    </div>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Buat Permohonan Cuti Baru</h2>
                            <p className="text-xs text-gray-500 mt-1">Silakan lengkapi tanggal dan alasan cuti di bawah ini.</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sisa Kuota Cuti</span>
                            <span className="text-3xl font-bold text-blue-600">{userData.sisa_cuti} <span className="text-sm font-semibold text-gray-500">Hari</span></span>
                        </div>
                    </div>

                    <form onSubmit={submitCuti} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded border border-gray-100">
                            <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">NIP</span><strong className="text-sm text-gray-800">{userData.nip || "-"}</strong></div>
                            <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nama Lengkap</span><strong className="text-sm text-gray-800">{userData.name}</strong></div>
                            <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Divisi / Jabatan</span><strong className="text-sm text-gray-800">{userData.divisi} / {userData.jabatan || "-"}</strong></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal Mulai Cuti</label>
                                <input type="date" required value={mulai} onChange={(e) => setMulai(e.target.value)} className="w-full border-gray-300 p-2.5 rounded border focus:ring-blue-500 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal Selesai Cuti</label>
                                <input type="date" required value={selesai} onChange={(e) => setSelesai(e.target.value)} className="w-full border-gray-300 p-2.5 rounded border focus:ring-blue-500 text-sm outline-none" />
                            </div>
                        </div>

                        {mulai && selesai && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mt-2">
                                Estimasi cuti yang terhitung memotong kuota: <strong>{estimasiHari}</strong> hari kerja.
                            </div>
                        )}

                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Alamat Selama Menjalankan Cuti</label><textarea required rows="2" value={alamat} onChange={(e) => setAlamat(e.target.value)} className="w-full border-gray-300 p-2.5 rounded border focus:ring-blue-500 text-sm outline-none resize-none"></textarea></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Nomor HP / Kontak Darurat</label><input type="text" required value={kontak} onChange={(e) => setKontak(e.target.value)} className="w-full border-gray-300 p-2.5 rounded border focus:ring-blue-500 text-sm outline-none" /></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Alasan / Keterangan Cuti <span className="text-red-500">*</span></label><textarea required minLength="5" rows="3" value={alasan} onChange={(e) => setAlasan(e.target.value)} className="w-full border-gray-300 p-2.5 rounded border focus:ring-blue-500 text-sm outline-none resize-none"></textarea></div>

                        <div className="pt-4 border-t border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Pemohon <span className="text-red-500">*</span></label>
                            <div className="border border-dashed border-gray-300 rounded-lg bg-gray-50 p-2 flex flex-col w-full max-w-md">
                                <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: "bg-white border border-gray-200 w-full h-32 rounded cursor-crosshair" }}/>
                                <button type="button" onClick={() => sigCanvas.current.clear()} className="mt-2 text-xs text-red-500 font-semibold hover:underline text-left">Bersihkan / Ulangi</button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button type="submit" className="bg-[#2563eb] text-white font-semibold px-6 py-2.5 rounded hover:bg-blue-700 shadow-sm text-sm transition">Kirim Pengajuan ke SPV</button>
                        </div>
                    </form>
                </div>

                {/* RIWAYAT CUTI (Dapat diklik untuk melihat Modal) */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mt-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">Riwayat Pengajuan Cuti Anda</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b">
                                <tr className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                    <th className="pb-3 w-[25%]">Periode Cuti</th>
                                    <th className="pb-3 w-[15%]">Durasi</th>
                                    <th className="pb-3 w-[30%]">Alasan</th>
                                    <th className="pb-3 w-[15%] text-center">Status</th>
                                    <th className="pb-3 w-[15%] text-center">Aksi / Cetak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {riwayat.length === 0 ? (
                                    <tr><td colSpan="5" className="py-8 text-center text-gray-400">Belum ada riwayat cuti.</td></tr>
                                ) : (
                                    riwayat.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setModalDetail({ isOpen: true, data: item })}>
                                            <td className="py-4 text-xs font-semibold text-gray-800">{item.tanggal_mulai.split("-").reverse().join("/")} - {item.tanggal_selesai.split("-").reverse().join("/")}</td>
                                            <td className="py-4 text-xs font-bold text-blue-600">{item.jumlah_hari} Hari</td>
                                            <td className="py-4 text-xs text-gray-600 truncate max-w-[200px]" title={item.alasan}>{item.alasan}</td>
                                            <td className="py-4 text-center">
                                                {item.status === 'approved' ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">✓ ACC Final</span> :
                                                 item.status === 'pending_hrd' ? <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">⏳ Cek HRD</span> :
                                                 item.status === 'pending_spv' ? <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">⏳ Cek SPV</span> :
                                                 item.status === 'rejected_spv' ? <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">✕ Tolak SPV</span> :
                                                 <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">✕ Tolak HRD</span>}
                                            </td>
                                            <td className="py-4 text-center">
                                                {item.status === 'approved' && (
                                                    <button onClick={(e) => { e.stopPropagation(); window.open(`/cuti/${item.id}/print`, '_blank'); }} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded shadow-sm hover:bg-blue-100 transition flex items-center gap-1 mx-auto">📄 Unduh PDF</button>
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

            {/* MODAL KARTU DETAIL PERMOHONAN */}
            {modalDetail.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalDetail({ isOpen: false, data: null })}>
                    <div className="bg-white rounded-xl shadow-2xl p-7 max-w-xl w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b pb-4 mb-5">
                            <div><h3 className="text-xl font-bold text-gray-900">Detail Permohonan Cuti</h3><p className="text-xs font-mono text-gray-500 mt-1">{modalDetail.data.nomor_surat || "Status: Sedang Diproses"}</p></div>
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">✕</button>
                        </div>
                        
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Nama Pegawai</div><div className="col-span-2 font-bold text-gray-900">{modalDetail.data.nama_karyawan} ({modalDetail.data.nip})</div></div>
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Periode & Durasi</div><div className="col-span-2 text-gray-800"><span className="font-semibold">{modalDetail.data.tanggal_mulai.split("-").reverse().join("/")}</span> s/d <span className="font-semibold">{modalDetail.data.tanggal_selesai.split("-").reverse().join("/")}</span><span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">{modalDetail.data.jumlah_hari} Hari Kerja</span></div></div>
                            <div className="grid grid-cols-3 gap-4 border-b border-gray-50 pb-4"><div className="col-span-1 text-gray-500 font-semibold">Kontak & Alamat</div><div className="col-span-2 text-gray-800 leading-relaxed">{modalDetail.data.kontak_darurat}<br/><span className="text-xs text-gray-500">{modalDetail.data.alamat_cuti}</span></div></div>
                            <div className="grid grid-cols-1 gap-2 border-b border-gray-50 pb-4"><div className="text-gray-500 font-semibold mb-1">Alasan Lengkap Cuti :</div><div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 leading-relaxed italic whitespace-pre-wrap">"{modalDetail.data.alasan}"</div></div>

                            {(modalDetail.data.catatan_spv || modalDetail.data.catatan_hrd) && (
                                <div className="grid grid-cols-1 gap-2 bg-rose-50/50 p-3 rounded-lg border border-rose-100"><div className="text-rose-700 font-semibold mb-1 text-xs uppercase tracking-wider">Catatan Keputusan :</div><div className="text-rose-900 text-sm font-medium">{modalDetail.data.catatan_hrd || modalDetail.data.catatan_spv}</div></div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setModalDetail({ isOpen: false, data: null })} className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}