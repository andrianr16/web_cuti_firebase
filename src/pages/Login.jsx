import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/"); 
        } catch (error) {
            alert("Login gagal! Periksa email dan password Anda.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow border max-w-sm w-full">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">E-Cuti Lestari</h2>
                    <p className="text-sm text-gray-500">Silakan login ke akun Anda</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">Email</label>
                        <input type="email" required onChange={(e) => setEmail(e.target.value)} className="w-full border p-2.5 rounded focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">Password</label>
                        <input type="password" required onChange={(e) => setPassword(e.target.value)} className="w-full border p-2.5 rounded focus:ring-blue-500" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">
                        {loading ? "Memeriksa..." : "Masuk"}
                    </button>
                </form>
            </div>
        </div>
    );
}