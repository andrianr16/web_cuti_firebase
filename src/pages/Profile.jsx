import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { useNavigate, Link } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";

export default function Profile() {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const sigCanvas = useRef({});

    // Form Profile
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    
    // Form Password
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

    useEffect(() => {
        const fetchUser = async () => {
            const user = auth.currentUser;
            if (!user) return navigate("/login");

            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.role === "karyawan") {
                    alert("Akses ditolak. Karyawan tidak memiliki halaman profil mandiri.");
                    return navigate("/");
                }
                setUserData({ id: user.uid, ...data });
                setName(data.name || "");
                setEmail(data.email || "");
            }
            setLoading(false);
        };
        fetchUser();
    }, [navigate]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            let ttdBase64 = userData.signature_pad || null;
            
            if (!sigCanvas.current.isEmpty()) {
                const canvasElement = sigCanvas.current.getCanvas();
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvasElement.width;
                tempCanvas.height = canvasElement.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(canvasElement, 0, 0);
                ttdBase64 = tempCanvas.toDataURL("image/jpeg", 0.5);
            }

            const updateData = { signature_pad: ttdBase64 };
            if (userData.role === "hrd") updateData.name = name;

            await updateDoc(doc(db, "users", userData.id), updateData);
            alert("Informasi Profil & Tanda Tangan berhasil diperbarui!");
            window.location.reload();
        } catch (error) {
            alert("Gagal memperbarui profil.");
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passwords.new.length < 6) return alert("Password baru minimal 6 karakter.");
        if (passwords.new !== passwords.confirm) return alert("Konfirmasi password tidak cocok.");
        
        try {
            const user = auth.currentUser;
            await updatePassword(user, passwords.new);
            alert("Password berhasil diperbarui!");
            setPasswords({ current: "", new: "", confirm: "" });
        } catch (error) {
            alert("Gagal memperbarui password. Pastikan Anda baru saja login. Jika error berlanjut, silakan logout dan login kembali.");
            console.error(error);
        }
    };

    if (loading || !userData) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-semibold text-gray-500">Memuat profil...</div>;

    const backLink = userData.role === "hrd" ? "/hrd/karyawan" : "/spv/cuti";

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-10">
            {/* Navbar Minimalis */}
            <div className="bg-white border-b px-8 flex justify-between items-center shadow-sm h-16 sticky top-0 z-50">
                <div className="flex items-center gap-4 h-full">
                    <Link to={backLink} className="text-gray-500 hover:text-blue-600 text-sm font-bold flex items-center gap-2">
                        ← Kembali ke Dashboard
                    </Link>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 mt-10 space-y-8">
                
                {/* Kartu Update Profile & Signature */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Profile Information</h2>
                        <p className="text-sm text-gray-500 mt-1">Update your account's profile information and digital signature.</p>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                disabled={userData.role !== "hrd"} 
                                className={`w-full max-w-xl border-gray-300 p-2.5 rounded-lg border text-sm outline-none ${userData.role !== "hrd" ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "focus:ring-blue-500"}`} 
                            />
                            {userData.role === "supervisor" && <p className="text-[10px] text-gray-400 mt-1">*Nama Supervisor hanya dapat diubah oleh HRD.</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                            <input 
                                type="email" 
                                value={email} 
                                disabled
                                className="w-full max-w-xl border-gray-300 p-2.5 rounded-lg border bg-gray-100 text-gray-500 text-sm outline-none cursor-not-allowed" 
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tanda Tangan Digital Resmi</label>
                            
                            {userData.signature_pad && (
                                <div className="mb-3">
                                    <span className="text-[11px] text-gray-500 mb-1 block">Tanda tangan yang sedang aktif:</span>
                                    <img src={userData.signature_pad} alt="TTD" className="h-20 border border-gray-200 rounded bg-white p-1 object-contain" />
                                </div>
                            )}

                            <div className="border border-dashed border-gray-300 rounded-lg bg-gray-50 p-2 w-full max-w-sm">
                                <SignatureCanvas 
                                    ref={sigCanvas}
                                    penColor="black"
                                    canvasProps={{ className: "bg-white border border-gray-200 w-full h-32 rounded cursor-crosshair" }}
                                />
                                <button type="button" onClick={() => sigCanvas.current.clear()} className="mt-2 text-xs text-red-500 font-semibold hover:underline">
                                    Bersihkan / Gambar Ulang
                                </button>
                            </div>
                        </div>

                        <div>
                            <button type="submit" className="bg-[#18181b] hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm transition">
                                SAVE
                            </button>
                        </div>
                    </form>
                </div>

                {/* Kartu Update Password */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Update Password</h2>
                        <p className="text-sm text-gray-500 mt-1">Ensure your account is using a long, random password to stay secure.</p>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                            <input 
                                type="password" 
                                required
                                value={passwords.new} 
                                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                className="w-full max-w-xl border-gray-300 p-2.5 rounded-lg border focus:ring-blue-500 text-sm outline-none" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                            <input 
                                type="password" 
                                required
                                value={passwords.confirm} 
                                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                className="w-full max-w-xl border-gray-300 p-2.5 rounded-lg border focus:ring-blue-500 text-sm outline-none" 
                            />
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="bg-[#18181b] hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm transition">
                                SAVE
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}