import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function CetakCuti() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [cuti, setCuti] = useState(null);
    const [user, setUser] = useState(null);
    const [hrd, setHrd] = useState(null);
    const [spv, setSpv] = useState(null);
    const [loading, setLoading] = useState(true);

    const daftarPT = {
        supra: "PT. Supra Raga Transport",
        joya: "PT. Joya Hougan Lestari",
        minyak: "PT. Lestari Minyak Alam",
        seg: "PT. Sarana Energi Graha"
    };

    useEffect(() => {
        const fetchSurat = async () => {
            try {
                // Ambil Dokumen Cuti
                const cutiRef = doc(db, "cuti_requests", id);
                const cutiSnap = await getDoc(cutiRef);
                if (!cutiSnap.exists()) return alert("Dokumen tidak ditemukan!");
                const dataCuti = cutiSnap.data();
                setCuti(dataCuti);

                // Ambil Data Karyawan (Pemohon)
                const userRef = doc(db, "users", dataCuti.user_id);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) setUser(userSnap.data());

                // Ambil Data SPV (Jika Ada)
                if (dataCuti.spv_id) {
                    const spvRef = doc(db, "users", dataCuti.spv_id);
                    const spvSnap = await getDoc(spvRef);
                    if (spvSnap.exists()) setSpv(spvSnap.data());
                }

                // Ambil Data HRD (Jika Ada)
                if (dataCuti.hrd_id) {
                    const hrdRef = doc(db, "users", dataCuti.hrd_id);
                    const hrdSnap = await getDoc(hrdRef);
                    if (hrdSnap.exists()) setHrd(hrdSnap.data());
                }
            } catch (error) {
                console.error("Gagal memuat dokumen:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSurat();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading || !user) return <div className="p-10 text-center">Memuat Dokumen...</div>;

    const namaPT = daftarPT[user.pabrik?.toLowerCase()] || "LESTARI GROUP";
    const sisaCutiSaatIni = cuti.status === 'approved' ? user.sisa_cuti : (user.sisa_cuti - cuti.jumlah_hari);
    const hakCutiTimbul = 12;

    return (
        <div className="bg-gray-100 min-h-screen py-8 print:py-0 print:bg-white font-sans text-black">
            {/* Panel Tombol Aksi (Akan Hilang Saat Dicetak) */}
            <div className="max-w-[750px] mx-auto mb-4 flex justify-between items-center print:hidden">
                {/* Tombol kembali diubah menjadi fungsi window.close() */}
                <button onClick={() => window.close()} className="px-4 py-2 bg-gray-500 text-white text-sm rounded shadow hover:bg-gray-600 font-bold">
                    Tutup
                </button>
                <div className="space-x-3">
                    <button onClick={handlePrint} className="px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded shadow hover:bg-blue-700">
                        🖨️ Cetak / Unduh PDF
                    </button>
                </div>
            </div>

            {/* LEMBAR A4 */}
            <div className="max-w-[750px] mx-auto bg-white border-2 border-black p-8 print:p-0 print:border-0 print:shadow-none shadow-xl text-[12px] leading-tight">
                
                {/* Header Kop Surat */}
                <table className="w-full border-b-2 border-black pb-2 mb-4">
                    <tbody>
                        <tr>
                            <td className="w-1/4 align-middle text-left font-bold text-green-700 text-lg uppercase">
                                {/* LOGO PERUSAHAAN DIMASUKKAN DI SINI */}
                                <img 
                                    src="/logo.png" 
                                    alt="Logo Perusahaan" 
                                    className="h-10 object-contain" 
                                    onError={(e) => { e.target.outerHTML = '<span>LESTARI GROUP</span>'; }} 
                                />
                            </td>
                            <td className="w-2/4 align-middle text-center">
                                <h2 className="m-0 text-xl font-bold tracking-wide uppercase">Permohonan Cuti</h2>
                            </td>
                            <td className="w-1/4"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Bagian 1: Karyawan */}
                <p className="mb-3">Yang bertanda tangan di bawah ini, saya :</p>
                <table className="w-full text-[12px] mb-4">
                    <tbody>
                        <tr>
                            <td className="w-1/4 py-1">Nama</td>
                            <td className="w-[2%]">:</td>
                            <td className="w-[73%] border-b border-black font-bold">{user.name}</td>
                        </tr>
                        <tr>
                            <td className="py-1">Divisi / Jabatan</td>
                            <td>:</td>
                            <td className="border-b border-black">{user.divisi || "-"} / {user.jabatan || "-"}</td>
                        </tr>
                        <tr>
                            <td className="py-1">Unit Kerja / PT</td>
                            <td>:</td>
                            <td className="border-b border-black font-bold">{namaPT}</td>
                        </tr>
                        <tr>
                            <td className="py-1">Dengan ini mengajukan untuk</td>
                            <td>:</td>
                            <td className="border-b border-black font-bold">{cuti.jenis_permohonan || 'Cuti Tahunan'}</td>
                        </tr>
                        <tr>
                            <td className="py-1">Selama</td>
                            <td>:</td>
                            <td className="border-b border-black">{cuti.jumlah_hari} hari kerja</td>
                        </tr>
                        <tr>
                            <td className="py-1">Terhitung mulai hari</td>
                            <td>:</td>
                            <td className="border-b border-black">
                                Tanggal: {new Date(cuti.tanggal_mulai).toLocaleDateString('id-ID')}
                            </td>
                        </tr>
                        <tr>
                            <td className="py-1">Sampai dengan hari</td>
                            <td>:</td>
                            <td className="border-b border-black">
                                Tanggal: {new Date(cuti.tanggal_selesai).toLocaleDateString('id-ID')}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="3" className="pt-3 pb-1">Alamat yang dapat dihubungi selama saya menjalankan cuti :</td>
                        </tr>
                        <tr>
                            <td className="pl-4 py-1">- Alamat</td>
                            <td>:</td>
                            <td className="border-b border-black">{cuti.alamat_cuti || '-'}</td>
                        </tr>
                        <tr>
                            <td className="pl-4 py-1">- Telepon</td>
                            <td>:</td>
                            <td className="border-b border-black">{cuti.kontak_darurat || '-'}</td>
                        </tr>
                        <tr>
                            <td colSpan="3" className="pt-3 pb-1">Permohonan untuk izin, harus disebutkan keperluan :</td>
                        </tr>
                        <tr>
                            <td colSpan="3" className="border-b border-black italic py-1">{cuti.alasan}</td>
                        </tr>
                    </tbody>
                </table>

                {/* TTD Karyawan & Atasan */}
                <table className="w-full text-center mt-6">
                    <tbody>
                        <tr>
                            <td className="w-1/2"></td>
                            <td className="w-1/2 text-right pr-4">Tanggal Diajukan: {new Date(cuti.diajukan_pada).toLocaleDateString('id-ID')}</td>
                        </tr>
                        <tr>
                            <td className="pt-2">Disetujui oleh,</td>
                            <td className="pt-2">Pemohon,</td>
                        </tr>
                        <tr>
                            <td className="h-[60px] align-bottom">
                                {cuti.ttd_spv && <img src={cuti.ttd_spv} alt="TTD SPV" className="h-[50px] mx-auto object-contain" />}
                            </td>
                            <td className="h-[60px] align-bottom">
                                {cuti.ttd_karyawan && <img src={cuti.ttd_karyawan} alt="TTD Karyawan" className="h-[50px] mx-auto object-contain" />}
                            </td>
                        </tr>
                        <tr>
                            <td><u className="font-bold">{spv ? spv.name : '( Kepala Bagian / Supervisor )'}</u><br/><span className="text-[10px]">(Supervisor)</span></td>
                            <td><u className="font-bold">{user.name}</u></td>
                        </tr>
                    </tbody>
                </table>

                <div className="text-[10px] mt-2 mb-6">*) Coret yang tidak perlu</div>

                {/* Bagian 2: Personalia HRD */}
                <div className="text-center font-bold text-[13px] border-y-2 border-black py-1 mb-4 uppercase">
                    DIISI OLEH BAGIAN PERSONALIA
                </div>

                <table className="w-full text-[12px]">
                    <tbody>
                        <tr>
                            <td className="w-[30%] py-1">* Mulai Masuk Kerja</td>
                            <td className="w-[2%]">:</td>
                            <td colSpan="2" className="border-b border-black">
                                {user.tgl_masuk_kerja ? new Date(user.tgl_masuk_kerja).toLocaleDateString('id-ID') : '-'}
                            </td>
                        </tr>
                        <tr>
                            <td className="py-1">* Hak cuti timbul</td>
                            <td>:</td>
                            <td colSpan="2" className="border-b border-black">{hakCutiTimbul} hari kerja</td>
                        </tr>
                        <tr>
                            <td className="py-1">* Sisa hak cuti tahun sebelumnya</td>
                            <td>:</td>
                            <td className="w-[15%] border-b border-black">0</td>
                            <td className="w-[53%]">hari kerja</td>
                        </tr>
                        <tr>
                            <td className="py-1 font-bold">Jumlah Hak Cuti</td>
                            <td className="font-bold">:</td>
                            <td className="border-b border-black font-bold">
                                {sisaCutiSaatIni + (cuti.status === 'approved' ? cuti.jumlah_hari : 0)}
                            </td>
                            <td className="font-bold">hari kerja</td>
                        </tr>
                        <tr>
                            <td colSpan="4" className="pt-3 pb-1 font-bold">* Perhitungan hak cuti</td>
                        </tr>
                        <tr>
                            <td className="pl-4 py-1">- Hak cuti yang masih ada</td>
                            <td>:</td>
                            <td className="border-b border-black">{sisaCutiSaatIni + (cuti.status === 'approved' ? cuti.jumlah_hari : 0)}</td>
                            <td>hari kerja</td>
                        </tr>
                        <tr>
                            <td className="pl-4 py-1">- Jumlah cuti yang dimohon</td>
                            <td>:</td>
                            <td className="border-b border-black">{cuti.jumlah_hari}</td>
                            <td className="text-[10px]">hari kerja (Tgl {new Date(cuti.tanggal_mulai).toLocaleDateString('id-ID')} s.d {new Date(cuti.tanggal_selesai).toLocaleDateString('id-ID')})</td>
                        </tr>
                        <tr className="font-bold">
                            <td className="text-right pr-4 py-1">SISA CUTI</td>
                            <td>:</td>
                            <td className="border-t border-b-2 border-black py-1">{sisaCutiSaatIni}</td>
                            <td className="border-t border-b-2 border-black py-1">hari kerja</td>
                        </tr>
                    </tbody>
                </table>

                {/* TTD HRD */}
                <table className="w-full text-center mt-6">
                    <tbody>
                        <tr>
                            <td className="w-1/2"></td>
                            <td className="w-1/2 text-right pr-4">Tanggal Keputusan: {cuti.hrd_approved_at ? new Date(cuti.hrd_approved_at).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>
                        <tr>
                            <td className="pt-2">Disetujui oleh,</td>
                            <td className="pt-2">Personalia / HRD,</td>
                        </tr>
                        <tr>
                            <td className="h-[60px] align-bottom">
                                {cuti.ttd_spv && <img src={cuti.ttd_spv} alt="TTD SPV" className="h-[50px] mx-auto object-contain" />}
                            </td>
                            <td className="h-[60px] align-bottom text-center">
                                {/* TTD HRD DITAMPILKAN DI SINI JIKA ADA */}
                                {cuti.ttd_hrd ? (
                                    <img src={cuti.ttd_hrd} alt="TTD HRD" className="h-[50px] mx-auto object-contain" />
                                ) : cuti.status === 'approved' ? (
                                    <div className="border border-green-600 text-green-700 font-bold inline-block px-3 py-1 mb-2">VERIFIED HRD</div>
                                ) : (
                                    <div className="h-[50px]"></div>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td><u className="font-bold">{spv ? spv.name : '( Kepala Bagian / Supervisor )'}</u><br/><span className="text-[10px]">(Supervisor)</span></td>
                            <td><u className="font-bold">{hrd ? hrd.name : 'Bagian Personalia'}</u></td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-4 pb-4">
                    <strong className="text-[11px]">Catatan :</strong>
                    <div className="border-b border-black italic min-h-[16px] text-[11px]">
                        {cuti.catatan_hrd || '-'}
                    </div>
                </div>

            </div>
        </div>
    );
}