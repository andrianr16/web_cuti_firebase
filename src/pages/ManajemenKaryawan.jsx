import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db, secondaryAuth } from "../firebaseConfig";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function ManajemenKaryawan() {
    const [karyawan, setKaryawan] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalTambah, setModalTambah] = useState(false);
    
    // Modal Edit & Delete
    const [modalEdit, setModalEdit] = useState({ isOpen: false, data: null });

    // Modal Riwayat Cuti
    const [modalRiwayat, setModalRiwayat] = useState({ isOpen: false, dataKaryawan: null, riwayatCuti: [] });

    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Form Karyawan Baru / Edit
    const [form, setForm] = useState({
        nip: "", name: "", email: "", password: "", pabrik: "supra", divisi: "", jabatan: "", kategori: "tkl", tgl_masuk_kerja: "", sisa_cuti: 12, sisa_cuti_lalu: 0
    });

    const [filters, setFilters] = useState({
        nip: "", nama: "", pabrik: "semua", divisi: "semua", kategori: "semua", jabatan: "semua"
    });

    const [opsiDivisi, setOpsiDivisi] = useState([]);
    const [opsiKategori, setOpsiKategori] = useState([]);
    const [opsiJabatan, setOpsiJabatan] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
                if (!userDoc.empty) setUserData(userDoc.docs[0].data());
            }

            try {
                const q = query(collection(db, "users"), where("role", "==", "karyawan"));
                const snap = await getDocs(q);
                const allKaryawan = snap.docs.map(doc => doc.data());
                
                const uniqDivisi = [...new Set(allKaryawan.map(k => k.divisi).filter(Boolean))].sort();
                const uniqKategori = [...new Set(allKaryawan.map(k => k.kategori).filter(Boolean))].sort();
                const uniqJabatan = [...new Set(allKaryawan.map(k => k.jabatan).filter(Boolean))].sort();

                setOpsiDivisi(uniqDivisi);
                setOpsiKategori(uniqKategori);
                setOpsiJabatan(uniqJabatan);
            } catch (err) {
                console.error("Gagal memuat opsi filter:", err);
            }
        };
        fetchInitialData();
    }, []);

    const fetchFilteredKaryawan = async (overrideFilters = null) => {
        const activeFilters = overrideFilters || filters;
        
        if (
            activeFilters.pabrik === "semua" && 
            activeFilters.divisi === "semua" && 
            activeFilters.kategori === "semua" && 
            activeFilters.jabatan === "semua" &&
            activeFilters.nip.trim() === "" &&
            activeFilters.nama.trim() === ""
        ) {
            setKaryawan([]);
            return;
        }

        setLoading(true);
        try {
            let q = query(collection(db, "users"), where("role", "==", "karyawan"));
            
            if (activeFilters.pabrik !== "semua") {
                q = query(collection(db, "users"), where("role", "==", "karyawan"), where("pabrik", "==", activeFilters.pabrik.toLowerCase()));
            }

            const querySnapshot = await getDocs(q);
            let data = [];
            querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));

            if (activeFilters.divisi !== "semua") data = data.filter(k => k.divisi === activeFilters.divisi);
            if (activeFilters.kategori !== "semua") data = data.filter(k => k.kategori === activeFilters.kategori);
            if (activeFilters.jabatan !== "semua") data = data.filter(k => k.jabatan === activeFilters.jabatan);
            if (activeFilters.nip.trim() !== "") data = data.filter(k => (k.nip || "").toLowerCase().includes(activeFilters.nip.toLowerCase()));
            if (activeFilters.nama.trim() !== "") data = data.filter(k => (k.name || "").toLowerCase().includes(activeFilters.nama.toLowerCase()));

            data.sort((a, b) => (a.divisi > b.divisi) ? 1 : (a.divisi === b.divisi) ? ((a.name > b.name) ? 1 : -1) : -1 );
            setKaryawan(data);
        } catch (error) {
            console.error("Gagal memuat data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterDropdownChange = (e) => {
        const { name, value } = e.target;
        const newFilters = { ...filters, [name]: value };
        setFilters(newFilters);
        fetchFilteredKaryawan(newFilters);
    };

    const handleSearchClick = (e) => {
        e.preventDefault();
        fetchFilteredKaryawan();
    };

    const handleResetFilter = () => {
        const resetData = { nip: "", nama: "", pabrik: "semua", divisi: "semua", kategori: "semua", jabatan: "semua" };
        setFilters(resetData);
        setKaryawan([]); 
    };

    const handleTambahKaryawan = async (e) => {
        e.preventDefault();
        try {
            const res = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
            await setDoc(doc(db, "users", res.user.uid), {
                nip: form.nip,
                name: form.name,
                email: form.email,
                role: "karyawan",
                pabrik: form.pabrik,
                divisi: form.divisi,
                jabatan: form.jabatan,
                kategori: form.kategori || "tkl",
                tgl_masuk_kerja: form.tgl_masuk_kerja,
                sisa_cuti_lalu: parseInt(form.sisa_cuti_lalu) || 0,
                sisa_cuti: parseInt(form.sisa_cuti)
            });

            alert("Karyawan berhasil ditambahkan!");
            setModalTambah(false);
            window.location.reload();
        } catch (error) {
            alert("Gagal menambahkan karyawan: " + error.message);
        }
    };

    const bukaModalEdit = (k) => {
        setForm({
            nip: k.nip, name: k.name, email: k.email, pabrik: k.pabrik, divisi: k.divisi, jabatan: k.jabatan, kategori: k.kategori, tgl_masuk_kerja: k.tgl_masuk_kerja, sisa_cuti_lalu: k.sisa_cuti_lalu, sisa_cuti: k.sisa_cuti
        });
        setModalEdit({ isOpen: true, data: k });
    };

    const handleEditKaryawan = async (e) => {
        e.preventDefault();
        try {
            const updateData = {
                nip: form.nip,
                name: form.name,
                pabrik: form.pabrik,
                divisi: form.divisi,
                jabatan: form.jabatan,
                kategori: form.kategori,
                tgl_masuk_kerja: form.tgl_masuk_kerja,
                sisa_cuti_lalu: parseInt(form.sisa_cuti_lalu) || 0,
                sisa_cuti: parseInt(form.sisa_cuti)
            };

            await updateDoc(doc(db, "users", modalEdit.data.id), updateData);
            alert("Data karyawan berhasil diperbarui!");
            setModalEdit({ isOpen: false, data: null });
            fetchFilteredKaryawan(); 
        } catch (error) {
            alert("Gagal mengedit data karyawan: " + error.message);
        }
    };

    const handleHapusKaryawan = async (id, nama) => {
        if (!window.confirm(`Peringatan: Anda yakin ingin menghapus data karyawan atas nama ${nama}? Seluruh data terkait tidak dapat dikembalikan.`)) return;
        
        try {
            await deleteDoc(doc(db, "users", id));
            alert(`Data karyawan ${nama} berhasil dihapus.`);
            fetchFilteredKaryawan(); 
        } catch (error) {
            alert("Gagal menghapus karyawan: " + error.message);
        }
    };

    const bukaRiwayatKaryawan = async (k) => {
        try {
            const q = query(collection(db, "cuti_requests"), where("user_id", "==", k.id));
            const snap = await getDocs(q);
            const riwayatData = [];
            snap.forEach((doc) => riwayatData.push({ id: doc.id, ...doc.data() }));
            riwayatData.sort((a, b) => new Date(b.diajukan_pada) - new Date(a.diajukan_pada));
            
            setModalRiwayat({ isOpen: true, dataKaryawan: k, riwayatCuti: riwayatData });
        } catch (error) {
            alert("Gagal menarik data riwayat cuti karyawan.");
        }
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const rows = text.split('\n').map(row => row.split(','));
            const headers = rows[0].map(h => h.trim().toLowerCase());
            
            const batch = writeBatch(db);
            let count = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < headers.length) continue;

                const data = {};
                headers.forEach((h, index) => { data[h] = row[index]?.trim(); });
                if (!data.email || !data.nip) continue;

                try {
                    const res = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password || 'password123');
                    const userRef = doc(db, "users", res.user.uid);
                    batch.set(userRef, {
                        name: data.nama || data.name || "Karyawan",
                        email: data.email,
                        nip: data.nip,
                        role: 'karyawan',
                        pabrik: data.pabrik?.toLowerCase() || 'supra',
                        divisi: data.divisi || '-',
                        jabatan: data.jabatan || '-',
                        kategori: data.kategori?.toLowerCase() || 'tkl',
                        tgl_masuk_kerja: data.tgl_masuk_kerja || new Date().toISOString().split('T')[0],
                        sisa_cuti_lalu: parseInt(data.sisa_cuti_lalu) || 0,
                        sisa_cuti: parseInt(data.sisa_cuti) || 12
                    });
                    count++;
                } catch (err) {
                    console.error("Gagal import baris:", data.email, err);
                }
            }
            
            await batch.commit();
            alert(`Berhasil mengimpor ${count} karyawan dari CSV!`);
            window.location.reload();
        };
        reader.readAsText(file);
    };

    const handleUnduhTemplate = () => {
        const headers = "nip,nama,email,password,pabrik,divisi,kategori,jabatan,tgl_masuk_kerja,sisa_cuti_lalu,sisa_cuti\n";
        const sampleData1 = "KRY001,Agus Santoso,agus@perusahaan.com,password123,joya,IT,staff,Web Developer,2023-01-15,4,12\n";
        const sampleData2 = "KRY002,Budi Hartono,budi@perusahaan.com,password123,supra,Gudang,tkl,Operator,2023-08-10,0,12\n";
        
        const csvContent = "data:text/csv;charset=utf-8," + headers + sampleData1 + sampleData2;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Template_Import_Karyawan.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportCSV = () => {
        const BOM = "\uFEFF"; 
        const headers = ["No;NIP;Nama Karyawan;Pabrik;Divisi;Kategori;Jabatan;Tgl Masuk;Cuti Lalu;Sisa Cuti"];
        
        if (karyawan.length === 0) return alert("Tidak ada data karyawan yang tampil untuk diekspor. Silakan cari atau ubah filter terlebih dahulu.");

        const rows = karyawan.map((k, index) => {
            const no = index + 1;
            const nip = `='${k.nip || "-"}'`; 
            const nama = `"${k.name}"`; 
            const pabrik = `"${k.pabrik?.toUpperCase()}"`;
            const divisi = `"${k.divisi}"`;
            const kategori = `"${(k.kategori || "-").toUpperCase()}"`;
            const jabatan = `"${k.jabatan}"`;
            const tglMasuk = k.tgl_masuk_kerja || "-";
            const cutiLalu = `${k.sisa_cuti_lalu ?? 0} Hari`;
            const sisaCuti = `${k.sisa_cuti} Hari`;
            return `${no};${nip};${nama};${pabrik};${divisi};${kategori};${jabatan};${tglMasuk};${cutiLalu};${sisaCuti}`;
        });

        const csvContent = BOM + headers.concat(rows).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Data_Karyawan_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const karyawanPerPabrik = karyawan.reduce((acc, obj) => {
        const pabrik = (obj.pabrik || "Belum Ditentukan").toUpperCase();
        if (!acc[pabrik]) acc[pabrik] = [];
        acc[pabrik].push(obj);
        return acc;
    }, {});


    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-10">
            {/* Navbar HRD */}
            <div className="bg-white border-b px-8 flex justify-between items-center shadow-sm h-16 sticky top-0 z-50">
                <div className="flex items-center gap-8 h-full">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#84cc16] flex items-center justify-center text-white font-bold text-xs shadow-sm">LG</div>
                        <span className="font-bold text-gray-800 tracking-wide text-[10px] uppercase mt-2">Lestari Group</span>
                    </div>
                    <nav className="hidden md:flex h-full">
                        <Link to="/" className={`h-full flex items-center px-4 text-sm ${location.pathname === '/' ? 'font-bold text-blue-700 border-b-[3px] border-blue-700' : 'font-medium text-gray-500 hover:text-blue-600'}`}>Kelola Cuti (HRD)</Link>
                        <Link to="/hrd/karyawan" className={`h-full flex items-center px-4 text-sm ${location.pathname.includes('/karyawan') ? 'font-bold text-blue-700 border-b-[3px] border-blue-700' : 'font-medium text-gray-500 hover:text-blue-600'}`}>Monitoring Pabrik & Karyawan</Link>
                    </nav>
                </div>
                <div className="relative">
                    <button onClick={() => {
                        const menu = document.getElementById('userMenu');
                        menu.classList.toggle('hidden');
                    }} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 focus:outline-none">
                        {userData ? userData.name : 'Loading...'} 
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    
                    <div id="userMenu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50">
                        <Link to="/profile" className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
                            Profile
                        </Link>
                        <button onClick={() => auth.signOut()} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
                            Log Out
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 mt-8 space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Data Karyawan & Kuota Cuti</h1>
                        <p className="text-xs text-gray-500 mt-1">Monitoring kuota cuti dan manajemen data karyawan seluruh pabrik</p>
                    </div>
                    <button onClick={() => {
                        setForm({ nip: "", name: "", email: "", password: "", pabrik: "supra", divisi: "", jabatan: "", kategori: "tkl", tgl_masuk_kerja: "", sisa_cuti: 12, sisa_cuti_lalu: 0 });
                        setModalTambah(true);
                    }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm text-sm transition">
                        ➕ Tambah Karyawan Baru
                    </button>
                </div>

                {/* Panel Import & Export */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-b md:border-b-0 md:border-r border-gray-200 pb-5 md:pb-0 md:pr-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Import Massal</span>
                        <h4 className="text-sm font-bold text-gray-800">Unggah File CSV Karyawan</h4>
                        <p className="text-[10px] text-gray-500 mb-3">Kolom wajib: nip, nama, email, password, pabrik, divisi, jabatan, tgl_masuk_kerja, sisa_cuti</p>
                        
                        <div className="flex items-center gap-2">
                            <input type="file" accept=".csv" onChange={handleImportCSV} className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer w-full border border-gray-200"/>
                            <button onClick={handleUnduhTemplate} className="whitespace-nowrap px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg shadow-sm border border-gray-300 transition">
                                Unduh Template
                            </button>
                        </div>
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">Pusat Ekspor Laporan</span>
                        <h4 className="text-sm font-bold text-gray-800">Unduh Data Karyawan</h4>
                        <p className="text-[10px] text-gray-500 mb-3">Hasil ekspor akan berisi daftar karyawan sesuai dengan filter pencarian di bawah.</p>
                        <div className="flex items-center gap-3">
                            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm text-xs transition flex items-center gap-2">
                                Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Panel Filter & Pencarian */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <form onSubmit={handleSearchClick} className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-blue-600">🔍</span>
                                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Filter & Pencarian Data Karyawan</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 font-medium">Ditemukan: <strong>{karyawan.length} Orang</strong></span>
                                <button type="button" onClick={handleResetFilter} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold rounded-lg shadow-sm transition">
                                    Reset Filter
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Cari NIP</label>
                                <div className="relative flex items-center">
                                    <input type="text" name="nip" value={filters.nip} onChange={(e) => setFilters({...filters, nip: e.target.value})} placeholder="Ketik NIP..."
                                        className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 pl-3 pr-14 outline-none"/>
                                    <button type="submit" className="absolute right-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded shadow-xs transition">Cari</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Cari Nama</label>
                                <div className="relative flex items-center">
                                    <input type="text" name="nama" value={filters.nama} onChange={(e) => setFilters({...filters, nama: e.target.value})} placeholder="Ketik nama..."
                                        className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 pl-3 pr-14 outline-none"/>
                                    <button type="submit" className="absolute right-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded shadow-xs transition">Cari</button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Pabrik</label>
                                <select name="pabrik" value={filters.pabrik} onChange={handleFilterDropdownChange} 
                                    className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 cursor-pointer bg-white outline-none">
                                    <option value="semua">Semua Pabrik</option>
                                    <option value="supra">Pabrik Supra</option>
                                    <option value="joya">Pabrik Joya</option>
                                    <option value="minyak">Pabrik Minyak</option>
                                    <option value="seg">Pabrik SEG</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Divisi</label>
                                <select name="divisi" value={filters.divisi} onChange={handleFilterDropdownChange} 
                                    className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 cursor-pointer bg-white outline-none">
                                    <option value="semua">Semua Divisi</option>
                                    {opsiDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Kategori</label>
                                <select name="kategori" value={filters.kategori} onChange={handleFilterDropdownChange} 
                                    className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 cursor-pointer bg-white outline-none">
                                    <option value="semua">Semua Kategori</option>
                                    <option value="staff">Staff Kantor</option>
                                    <option value="tkl">TKL (Pabrik)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Jabatan</label>
                                <select name="jabatan" value={filters.jabatan} onChange={handleFilterDropdownChange} 
                                    className="w-full text-xs rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 py-2.5 px-3 cursor-pointer bg-white outline-none">
                                    <option value="semua">Semua Jabatan</option>
                                    {opsiJabatan.map(jab => <option key={jab} value={jab}>{jab}</option>)}
                                </select>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Tabel Data Karyawan Group by Pabrik */}
                {loading ? (
                    <div className="p-8 text-center text-gray-500 font-semibold animate-pulse">Menarik data dari database...</div>
                ) : (
                    Object.keys(karyawanPerPabrik).length === 0 ? (
                        <div className="bg-white border border-gray-200 p-12 rounded-xl text-center text-gray-400 shadow-sm flex flex-col items-center justify-center">
                            <span className="text-3xl mb-3">📄</span>
                            <p className="text-sm">Data belum dicari atau kriteria filter tidak cocok dengan data karyawan manapun.</p>
                        </div>
                    ) : (
                        Object.entries(karyawanPerPabrik).map(([namaPabrik, listKaryawan]) => (
                            <div key={namaPabrik} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                                <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-lg">🏭</span>
                                        <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">PABRIK {namaPabrik}</h3>
                                    </div>
                                    <span className="text-[11px] bg-gray-200 text-gray-700 font-bold px-3 py-1 rounded-full">
                                        {listKaryawan.length} Karyawan
                                    </span>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                                        <thead className="bg-white border-b border-gray-100">
                                            <tr className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                                <th className="px-4 py-3 text-left">NIP</th>
                                                <th className="px-4 py-3 text-left">NAMA KARYAWAN</th>
                                                <th className="px-4 py-3 text-left">DIVISI</th>
                                                <th className="px-4 py-3 text-left">JABATAN</th>
                                                <th className="px-4 py-3 text-center">KATEGORI</th>
                                                <th className="px-4 py-3 text-center">MASUK KERJA</th>
                                                <th className="px-4 py-3 text-center">CUTI LALU</th>
                                                <th className="px-4 py-3 text-center font-bold text-blue-700">SISA HAK CUTI</th>
                                                <th className="px-4 py-3 text-center">AKSI</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-700">
                                            {listKaryawan.map((k) => (
                                                <tr key={k.id} className="hover:bg-blue-50/40 transition bg-white">
                                                    <td className="px-4 py-4 font-mono font-bold text-gray-500 text-[11px]">{k.nip || "-"}</td>
                                                    <td className="px-4 py-4">
                                                        <button onClick={() => bukaRiwayatKaryawan(k)} className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{k.name}</button>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] rounded border border-gray-200 uppercase font-semibold">
                                                            {k.divisi || "-"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600 font-medium">{k.jabatan || "-"}</td>
                                                    <td className="px-4 py-4 text-center">
                                                        {k.kategori === 'staff' ? (
                                                            <span className="px-2.5 py-1 text-blue-600 border border-blue-200 bg-blue-50 text-[10px] font-bold rounded uppercase">STAFF</span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 text-emerald-600 border border-emerald-200 bg-emerald-50 text-[10px] font-bold rounded uppercase">TKL</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-gray-500 font-medium">
                                                        {k.tgl_masuk_kerja ? k.tgl_masuk_kerja.split("-").reverse().join("/") : "-"}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-gray-500 font-medium">
                                                        {k.sisa_cuti_lalu ?? 0} hari
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-extrabold text-blue-600">
                                                        {k.sisa_cuti} hari
                                                    </td>
                                                    <td className="px-4 py-4 text-center space-x-2 whitespace-nowrap">
                                                        <button onClick={() => bukaModalEdit(k)} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-300 text-[11px] font-bold rounded transition">
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handleHapusKaryawan(k.id, k.name)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300 text-[11px] font-bold rounded transition">
                                                            Hapus
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>

            {/* MODAL TAMBAH KARYAWAN */}
            {modalTambah && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Tambah Karyawan Baru</h3>
                            <button onClick={() => setModalTambah(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>
                        <form onSubmit={handleTambahKaryawan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold mb-1">NIP</label><input required type="text" onChange={e => setForm({...form, nip: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Nama Lengkap</label><input required type="text" onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Email Login</label><input required type="email" onChange={e => setForm({...form, email: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Password</label><input required type="password" onChange={e => setForm({...form, password: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Pabrik</label>
                                <select onChange={e => setForm({...form, pabrik: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm">
                                    <option value="supra">Supra</option><option value="joya">Joya</option><option value="minyak">Minyak</option><option value="seg">SEG</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-semibold mb-1">Divisi</label><input required type="text" onChange={e => setForm({...form, divisi: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Jabatan</label><input required type="text" onChange={e => setForm({...form, jabatan: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Kategori</label>
                                <select onChange={e => setForm({...form, kategori: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm">
                                    <option value="tkl">TKL (Pabrik)</option><option value="staff">Staff Kantor</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-semibold mb-1">Tgl Masuk Kerja</label><input required type="date" onChange={e => setForm({...form, tgl_masuk_kerja: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-xs font-semibold mb-1">Cuti Lalu</label><input required type="number" defaultValue="0" onChange={e => setForm({...form, sisa_cuti_lalu: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                                <div><label className="block text-xs font-semibold mb-1">Hak Cuti</label><input required type="number" defaultValue="12" onChange={e => setForm({...form, sisa_cuti: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t">
                                <button type="button" onClick={() => setModalTambah(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded hover:bg-gray-200 transition">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded shadow-sm hover:bg-blue-700 transition">Simpan Karyawan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDIT KARYAWAN */}
            {modalEdit.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Edit Data Karyawan</h3>
                            <button onClick={() => setModalEdit({ isOpen: false, data: null })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>
                        <form onSubmit={handleEditKaryawan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold mb-1">NIP</label><input required type="text" value={form.nip} onChange={e => setForm({...form, nip: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Nama Lengkap</label><input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Email Login</label><input type="email" disabled value={form.email} className="w-full border p-2 rounded outline-none text-sm bg-gray-100 text-gray-500 cursor-not-allowed"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Pabrik</label>
                                <select value={form.pabrik} onChange={e => setForm({...form, pabrik: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm">
                                    <option value="supra">Supra</option><option value="joya">Joya</option><option value="minyak">Minyak</option><option value="seg">SEG</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-semibold mb-1">Divisi</label><input required type="text" value={form.divisi} onChange={e => setForm({...form, divisi: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Jabatan</label><input required type="text" value={form.jabatan} onChange={e => setForm({...form, jabatan: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div><label className="block text-xs font-semibold mb-1">Kategori</label>
                                <select value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm">
                                    <option value="tkl">TKL (Pabrik)</option><option value="staff">Staff Kantor</option>
                                </select>
                            </div>
                            <div><label className="block text-xs font-semibold mb-1">Tgl Masuk Kerja</label><input required type="date" value={form.tgl_masuk_kerja} onChange={e => setForm({...form, tgl_masuk_kerja: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-xs font-semibold mb-1">Cuti Lalu</label><input required type="number" value={form.sisa_cuti_lalu} onChange={e => setForm({...form, sisa_cuti_lalu: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                                <div><label className="block text-xs font-semibold mb-1">Hak Cuti</label><input required type="number" value={form.sisa_cuti} onChange={e => setForm({...form, sisa_cuti: e.target.value})} className="w-full border p-2 rounded outline-none focus:border-blue-500 text-sm"/></div>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t">
                                <button type="button" onClick={() => setModalEdit({ isOpen: false, data: null })} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded hover:bg-gray-200 transition">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded shadow-sm hover:bg-blue-700 transition">Update Karyawan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL RIWAYAT CUTI SAAT NAMA DIKLIK */}
            {modalRiwayat.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start border-b pb-3 mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Riwayat Pengajuan Cuti</h3>
                                <p className="text-xs text-gray-500 mt-1">{modalRiwayat.dataKaryawan.name} | {modalRiwayat.dataKaryawan.nip || '-'} | {modalRiwayat.dataKaryawan.divisi || '-'}</p>
                            </div>
                            <button onClick={() => setModalRiwayat({ isOpen: false, dataKaryawan: null, riwayatCuti: [] })} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                                <thead className="bg-gray-50 border-y border-gray-200">
                                    <tr className="text-gray-500 font-bold uppercase tracking-widest">
                                        <th className="p-3 w-[20%]">Periode Cuti</th>
                                        <th className="p-3 w-[10%] text-center">Durasi</th>
                                        <th className="p-3 w-[25%]">Alasan</th>
                                        <th className="p-3 w-[15%] text-center">Status</th>
                                        <th className="p-3 w-[20%]">Catatan HRD/SPV</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {modalRiwayat.riwayatCuti.length === 0 ? (
                                        <tr><td colSpan="5" className="py-8 text-center text-gray-400">Belum ada riwayat pengajuan cuti.</td></tr>
                                    ) : (
                                        modalRiwayat.riwayatCuti.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-semibold text-gray-700">{item.tanggal_mulai.split("-").reverse().join("/")} s.d {item.tanggal_selesai.split("-").reverse().join("/")}</td>
                                                <td className="p-3 text-center font-bold text-blue-600">{item.jumlah_hari} Hari</td>
                                                <td className="p-3 text-gray-600 max-w-xs truncate" title={item.alasan}>{item.alasan}</td>
                                                <td className="p-3 text-center">
                                                    {item.status === 'approved' ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">✓ Disetujui</span> :
                                                     item.status === 'rejected' ? <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">✕ Ditolak HRD</span> :
                                                     item.status === 'rejected_spv' ? <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">✕ Ditolak SPV</span> :
                                                     <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">⏳ Menunggu</span>}
                                                </td>
                                                <td className="p-3 text-gray-500 italic max-w-xs truncate" title={item.catatan_hrd || item.catatan_spv}>{item.catatan_hrd || item.catatan_spv || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}