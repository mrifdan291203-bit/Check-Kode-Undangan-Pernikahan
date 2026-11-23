
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [undangan, setUndangan] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [kuota, setKuota] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formMessage, setFormMessage] = useState("");

  // State halaman check-in tamu
  const [publicCode, setPublicCode] = useState("");
  const [publicInvitation, setPublicInvitation] = useState(null);
  const [publicMessage, setPublicMessage] = useState("");
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicSubmitting, setPublicSubmitting] = useState(false);
  const [publicResult, setPublicResult] = useState(null);

  // Memeriksa sesi login
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Memeriksa status admin
  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      if (!session) {
        setIsAdmin(false);
        return;
      }

      setCheckingAdmin(true);

      const { data, error } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      console.log("USER ID:", session.user.id);
      console.log("ADMIN DATA:", data);
      console.log("ADMIN ERROR:", error);

      if (active) {
        setIsAdmin(!error && !!data);
        setCheckingAdmin(false);
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [session]);

  // Mengambil daftar undangan
  async function loadUndangan() {
    setLoadingData(true);

    const { data, error } = await supabase
      .from("undangan")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setFormMessage("Gagal mengambil data: " + error.message);
    } else {
      setUndangan(data || []);
    }

    setLoadingData(false);
  }

  useEffect(() => {
    if (session && isAdmin) {
      loadUndangan();
    }
  }, [session, isAdmin]);

  // Login
  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email atau password salah. Silakan coba lagi.");
    }
  }

  // Logout
  async function handleLogout() {
    await supabase.auth.signOut();

    setEmail("");
    setPassword("");
    setIsAdmin(false);
    setUndangan([]);
  }

  // Reset form
  function resetForm() {
    setKode("");
    setNama("");
    setKuota("");
    setEditingId(null);
    setFormMessage("");
  }

  // Simpan undangan baru atau edit
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormMessage("");

    const payload = {
      kode_undangan: kode.trim().toUpperCase(),
      nama_tamu: nama.trim(),
      kuota: Number(kuota),
    };

    if (editingId) {
      const { error } = await supabase
        .from("undangan")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setFormMessage("Gagal mengedit: " + error.message);
      } else {
        setFormMessage("Undangan berhasil diperbarui!");
        resetForm();
        await loadUndangan();
      }
    } else {
      const { error } = await supabase
        .from("undangan")
        .insert([payload]);

      if (error) {
        setFormMessage(
          error.code === "23505"
            ? "Kode undangan sudah digunakan!"
            : "Gagal menyimpan: " + error.message
        );
      } else {
        setFormMessage("Undangan berhasil ditambahkan!");
        resetForm();
        await loadUndangan();
      }
    }

    setSaving(false);
  }

  // Memulai edit
  function handleEdit(item) {
    setEditingId(item.id);
    setKode(item.kode_undangan);
    setNama(item.nama_tamu);
    setKuota(String(item.kuota));
    setFormMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Hapus undangan
  async function handleDelete(item) {
    const yakin = window.confirm(
      `Hapus undangan ${item.kode_undangan} milik ${item.nama_tamu}?`
    );

    if (!yakin) return;

    const { error } = await supabase
      .from("undangan")
      .delete()
      .eq("id", item.id);

    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      await loadUndangan();
    }
  }

  // Cek kode undangan dari halaman publik
  async function handleCheckInvitation(e) {
    e.preventDefault();
    setPublicMessage("");
    setPublicInvitation(null);
    setPublicResult(null);
    setPublicLoading(true);

    const { data, error } = await supabase.rpc("cek_undangan", {
      p_kode: publicCode.trim().toUpperCase(),
    });

    if (error) {
      setPublicMessage("Belum bisa memeriksa kode. Silakan coba lagi.");
    } else if (!data?.success) {
      setPublicMessage(
        data?.status === "already_checked_in"
          ? "Undangan ini sudah melakukan check-in."
          : "Kode undangan tidak ditemukan. Periksa kembali kode kamu."
      );
    } else {
      setPublicInvitation(data);
    }

    setPublicLoading(false);
  }

  // Check-in seluruh kuota keluarga sekaligus
  async function handlePublicCheckin() {
    setPublicSubmitting(true);
    setPublicMessage("");

    const { data, error } = await supabase.rpc("checkin_undangan", {
      p_kode: publicCode.trim().toUpperCase(),
    });

    if (error) {
      setPublicMessage("Check-in gagal. Silakan coba kembali atau hubungi panitia.");
    } else if (data?.success) {
      setPublicResult(data);
      setPublicInvitation(null);
      setPublicMessage("");
    } else if (data?.status === "already_checked_in") {
      setPublicInvitation(null);
      setPublicMessage("Maaf, undangan ini sudah pernah melakukan check-in.");
    } else {
      setPublicInvitation(null);
      setPublicMessage("Kode undangan tidak ditemukan.");
    }

    setPublicSubmitting(false);
  }

  const isCheckinPage = window.location.pathname.replace(/\/+$/, "") === "/checkin";

  if (isCheckinPage) {
    const pageStyle = {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "linear-gradient(135deg, #f8edf1, #edf4f8)",
      fontFamily: "Arial, sans-serif",
    };
    const cardStyle = {
      width: "100%",
      maxWidth: "420px",
      padding: "32px 26px",
      borderRadius: "22px",
      background: "#ffffff",
      boxShadow: "0 12px 40px rgba(60, 50, 60, 0.12)",
      textAlign: "center",
    };
    const buttonStyle = {
      width: "100%",
      border: "none",
      borderRadius: "12px",
      padding: "15px",
      background: "#9b6b83",
      color: "white",
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      marginTop: "14px",
    };
    const inputStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "15px",
      border: "1px solid #ded5da",
      borderRadius: "12px",
      fontSize: "18px",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: "2px",
      marginTop: "10px",
    };

    return (
      <div style={pageStyle}>
        <main style={cardStyle}>
          <div style={{ fontSize: "28px", color: "#9b6b83" }}>✦</div>
          <p style={{ fontSize: "11px", letterSpacing: "3px", color: "#9b6b83", fontWeight: 700 }}>
            WEDDING CHECK-IN
          </p>
          <h1 style={{ color: "#493944", margin: "8px 0" }}>Putri &amp; Rifdan</h1>
          <p style={{ color: "#777", marginBottom: "26px" }}>
            Silakan masukkan kode undangan kamu
          </p>

          {publicResult ? (
            <div>
              <div style={{ fontSize: "42px" }}>✓</div>
              <h2 style={{ color: "#287a50" }}>Check-in Berhasil!</h2>
              <p style={{ color: "#555" }}>{publicResult.nama_tamu}</p>
              <p style={{ color: "#555" }}>
                Seluruh kuota keluarga ({publicResult.kuota} orang) telah tercatat hadir.
              </p>
              <p style={{ color: "#888", fontSize: "13px" }}>
                Terima kasih sudah hadir di pernikahan kami.
              </p>
            </div>
          ) : publicInvitation ? (
            <div>
              <div style={{ background: "#f8f3f6", borderRadius: "14px", padding: "20px", marginTop: "18px" }}>
                <p style={{ color: "#777", fontSize: "13px", margin: "0 0 8px" }}>UNDANGAN DITEMUKAN</p>
                <h2 style={{ color: "#493944", margin: "0 0 12px" }}>{publicInvitation.nama_tamu}</h2>
                <div style={{ fontSize: "34px", fontWeight: 700, color: "#9b6b83" }}>
                  {publicInvitation.kuota} Orang
                </div>
                <p style={{ color: "#777", fontSize: "12px", margin: "4px 0 0" }}>Kuota keluarga</p>
              </div>
              <button
                type="button"
                style={buttonStyle}
                onClick={handlePublicCheckin}
                disabled={publicSubmitting}
              >
                {publicSubmitting ? "MEMPROSES..." : "KONFIRMASI CHECK-IN"}
              </button>
              <button
                type="button"
                onClick={() => { setPublicInvitation(null); setPublicCode(""); setPublicMessage(""); }}
                style={{ ...buttonStyle, background: "#eee8ec", color: "#66545f", marginTop: "8px" }}
              >
                BATAL / GANTI KODE
              </button>
            </div>
          ) : (
            <form onSubmit={handleCheckInvitation}>
              <input
                style={inputStyle}
                type="text"
                placeholder="CONTOH: MRPAO001"
                value={publicCode}
                onChange={(e) => setPublicCode(e.target.value.toUpperCase())}
                required
                autoComplete="off"
              />
              <button type="submit" style={buttonStyle} disabled={publicLoading}>
                {publicLoading ? "MEMERIKSA KODE..." : "LANJUTKAN"}
              </button>
            </form>
          )}

          {publicMessage && (
            <p style={{ color: "#b33b4b", fontSize: "13px", marginTop: "16px" }}>
              {publicMessage}
            </p>
          )}
          <p style={{ color: "#aaa", fontSize: "11px", marginTop: "28px", letterSpacing: "1px" }}>
            PUTRI &amp; RIFDAN WEDDING
          </p>
        </main>
      </div>
    );
  }

  const totalKuota = undangan.reduce(
    (total, item) => total + item.kuota,
    0
  );

  const totalHadir = undangan.reduce(
    (total, item) => total + item.jumlah_checkin,
    0
  );

  if (loading) {
    return <div className="loading">Memuat...</div>;
  }

  if (session && checkingAdmin) {
    return <div className="loading">Memeriksa akun admin...</div>;
  }

  if (session && !isAdmin) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Akses Ditolak</h2>
          <p>Akun ini belum terdaftar sebagai admin.</p>
          <button onClick={handleLogout}>Keluar</button>
        </div>
      </div>
    );
  }

  // Dashboard admin
  if (session && isAdmin) {
    return (
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <span className="admin-label">
              WEDDING MANAGEMENT
            </span>
            <h1>Putri & Rifdan</h1>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Keluar
          </button>
        </header>

        <main className="admin-content">
          <p className="admin-welcome">
            Selamat datang, Admin!
          </p>

          <h2>Dashboard Undangan</h2>

          <p>
            Sistem administrasi undangan pernikahan Putri & Rifdan.
          </p>

          {/* Statistik */}
          <div className="stats-grid">
            <div className="stat-card">
              <span>Total Undangan</span>
              <strong>{undangan.length}</strong>
            </div>

            <div className="stat-card">
              <span>Total Kuota</span>
              <strong>{totalKuota}</strong>
            </div>

            <div className="stat-card">
              <span>Sudah Check-in</span>
              <strong>{totalHadir}</strong>
            </div>

            <div className="stat-card">
              <span>Sisa Kuota</span>
              <strong>{totalKuota - totalHadir}</strong>
            </div>
          </div>

          {/* Form tambah undangan */}
          <section className="management-card">
            <h3>
              {editingId ? "Edit Undangan" : "Tambah Undangan"}
            </h3>

            <form onSubmit={handleSubmit}>
              <label>Kode Undangan</label>
              <input
                type="text"
                placeholder="Contoh: MRPAO001"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                required
              />

              <label>Nama Tamu / Keluarga</label>
              <input
                type="text"
                placeholder="Contoh: Keluarga Bapak Ahmad"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                required
              />

              <label>Jumlah Kuota</label>
              <input
                type="number"
                placeholder="Contoh: 4"
                min="1"
                step="1"
                value={kuota}
                onChange={(e) => setKuota(e.target.value)}
                required
              />

              {formMessage && (
                <div className="form-message">
                  {formMessage}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving
                    ? "MENYIMPAN..."
                    : editingId
                    ? "SIMPAN PERUBAHAN"
                    : "+ TAMBAH UNDANGAN"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={resetForm}
                  >
                    BATAL
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Daftar undangan */}
          <section className="management-card">
            <div className="list-heading">
              <h3>Daftar Undangan</h3>

              <button
                className="refresh-button"
                onClick={loadUndangan}
              >
                ↻ Refresh
              </button>
            </div>

            {loadingData ? (
              <p>Memuat data undangan...</p>
            ) : undangan.length === 0 ? (
              <p>Belum ada undangan yang ditambahkan.</p>
            ) : (
              <div className="table-wrapper">
                <table className="invitation-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Kode</th>
                      <th>Nama Keluarga</th>
                      <th>Kuota</th>
                      <th>Hadir</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {undangan.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.kode_undangan}</td>
                        <td>{item.nama_tamu}</td>
                        <td>{item.kuota}</td>
                        <td>{item.jumlah_checkin}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="edit-button"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </button>

                            <button
                              className="delete-button"
                              onClick={() => handleDelete(item)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // Halaman login
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-ornament">✦</div>

        <span className="admin-label">
          PRIVATE ADMIN ACCESS
        </span>

        <h1>
          Putri <span>&</span> Rifdan
        </h1>

        <p className="login-subtitle">
          Wedding Management
        </p>

        <div className="login-divider">❦</div>

        <h2>Admin Login</h2>

        <p className="login-description">
          Silakan masuk untuk mengelola data undangan.
        </p>

        <form onSubmit={handleLogin}>
          <label>Email</label>

          <input
            type="email"
            placeholder="Masukkan email admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="login-error">{error}</div>
          )}

          <button type="submit">
            MASUK KE DASHBOARD →
          </button>
        </form>

        <div className="login-footer">
          PUTRI & RIFDAN WEDDING
        </div>
      </div>
    </div>
  );
}

export default App;
