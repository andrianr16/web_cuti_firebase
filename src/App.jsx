import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Login from "./pages/Login";
import FormCuti from "./pages/FormCuti";
import DashboardSpv from "./pages/DashboardSpv";
import DashboardHrd from "./pages/DashboardHrd";
import CetakCuti from "./pages/CetakCuti";
import ManajemenKaryawan from "./pages/ManajemenKaryawan";
import Profile from "./pages/Profile";

function App() {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-semibold text-gray-500">Memuat aplikasi...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!userRole ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={
            !userRole ? <Navigate to="/login" /> :
            userRole === "karyawan" ? <FormCuti /> :
            userRole === "supervisor" ? <DashboardSpv /> :
            userRole === "hrd" ? <DashboardHrd /> : <Navigate to="/login" />
        } />
        
        <Route path="/cuti/:id/print" element={<CetakCuti />} />
        <Route path="/hrd/karyawan" element={userRole === "hrd" ? <ManajemenKaryawan /> : <Navigate to="/" />} />
        <Route path="/profile" element={(userRole === "hrd" || userRole === "supervisor") ? <Profile /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;