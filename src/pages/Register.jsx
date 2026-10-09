import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
    const [formData, setFormData] = useState({
        nip: "", name: "", email: "", password: "",
        role: "karyawan", pabrik: "joya", kategori: "staff",
        divisi: "", jabatan: "", tgl_masuk_kerja: "", sisa_cuti: 12
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                nip: formData.nip,
                name: formData.name,
                email: formData.email,
                role: formData.role,
                pabrik: formData.pabrik,
                kategori: formData.kategori,
                divisi: formData.divisi,
                jabatan: formData.jabatan,
                tgl_masuk_kerja: formData.tgl_masuk_kerja,
                sisa_cuti: Number(formData.sisa_cuti)
            });

            alert(`Akun ${formData.name} berhasil dibuat!`);
            navigate("/login");
        } catch (error) {
            alert("Gagal membuat akun: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow border max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Registrasi Akun Baru</h2>
                <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold mb-1">NIP</label><input type="text" name="nip" onChange={handleChange} required className="w-full border p-2 rounded" /></div>
                    <div><label className="block text-xs font-bold mb-1">Nama Lengkap</label><input type="text" name="name" onChange={handleChange} required className="w-full border p-2 rounded" /></div>
                    <div><label className="block text-xs font-bold mb-1">Email</label><input type="email" name="email" onChange={handleChange} required className="w-full border p-2 rounded" /></div>
                    <div><label className="block text-xs font-bold mb-1">Password (Min 6)</label><input type="password" name="password" onChange={handleChange} required minLength="6" className="w-full border p-2 rounded" /></div>
                    
                    <div>
                        <label className="block text-xs font-bold mb-1">Hak Akses (Role)</label>
                        <select name="role" onChange={handleChange} className="w-full border p-2 rounded">
                            <option value="karyawan">Karyawan</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="hrd">HRD</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Pabrik</label>
                        <select name="pabrik" onChange={handleChange} className="w-full border p-2 rounded">
                            <option value="joya">Joya</option>
                            <option value="supra">Supra</option>
                            <option value="minyak">Minyak</option>
                            <option value="seg">SEG</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1">Kategori</label>
                        <select name="kategori" onChange={handleChange} className="w-full border p-2 rounded">
                            <option value="staff">Staff</option>
                            <option value="tkl">TKL</option>
                        </select>
                    </div>
                    <div><label className="block text-xs font-bold mb-1">Tanggal Masuk Kerja</label><input type="date" name="tgl_masuk_kerja" onChange={handleChange} required className="w-full border p-2 rounded" /></div>
                    <div><label className="block text-xs font-bold mb-1">Divisi</label><input type="text" name="divisi" placeholder="Contoh: IT, Produksi" onChange={handleChange} required className="w-full border p-2 rounded" /></div>
                    <div><label className="block text-xs font-bold mb-1">Jabatan</label><input type="text" name="jabatan" onChange={handleChange} required className="w-full border p-2 rounded" /></div>

                    <div className="md:col-span-2 pt-4">
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">
                            {loading ? "Menyimpan..." : "Daftarkan Akun"}
                        </button>
                    </div>
                </form>
                <div className="mt-4 text-center text-sm">
                    Sudah punya akun? <Link to="/login" className="text-blue-600 font-bold">Login di sini</Link>
                </div>
            </div>
        </div>
    );
}