"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import SamcoIcon from "@/components/SamcoIcon";

type CompanyOption = {
  Company: string;
  CompanyName: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [company, setCompany] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/audit");
      return;
    }

    if (status === "unauthenticated") {
      void loadCompanies();
    }
  }, [status, router]);

  async function loadCompanies() {
    setLoadingCompanies(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/external-companies");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.message || "Cannot load companies");
      }

      setCompanies(result.companies || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("โหลดรายชื่อบริษัทไม่สำเร็จ กรุณาตรวจสอบ Project API / Basic Auth");
    } finally {
      setLoadingCompanies(false);
    }
  }

  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!company) {
      setErrorMessage("กรุณาเลือกบริษัท");
      return;
    }

    if (!username.trim() || password.length === 0) {
      setErrorMessage("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        company,
        companyName,
        username: username.trim(),
        password,
      });

      if (result?.error) {
        setErrorMessage("Username หรือ Password ไม่ถูกต้อง");
        return;
      }

      router.replace("/audit");
    } catch (error) {
      console.error(error);
      setErrorMessage("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <div className="login-hero">
        <div className="login-logo">
          <span className="logo-mark login-logo-mark"><span /></span>
          <span className="login-logo-text">
            <span className="logo-name">SAMMAKORN</span>
            <span className="logo-sub">PROPERTY</span>
          </span>
        </div>
        <div className="login-tag">QUALITY AUDIT SYSTEM</div>
      </div>

      <form className="login-card" onSubmit={submitLogin}>
        <div className="login-title">Weekly Site Audit</div>
        <div className="login-sub">เข้าสู่ระบบเพื่อเริ่มตรวจคุณภาพหน้างาน</div>

        <label className="lfield">
          <span className="ll"><SamcoIcon name="building" size={12} stroke={2} />บริษัท / หน่วยงาน</span>
          <span className="lselect">
            <select
              required
              value={company}
              disabled={loadingCompanies}
              onChange={(e) => {
                const selectedCompany = e.target.value;
                const selected = companies.find((item) => item.Company === selectedCompany);

                setCompany(selectedCompany);
                setCompanyName(selected?.CompanyName || selectedCompany);
                setErrorMessage("");
              }}
            >
              <option value="" disabled>
                {loadingCompanies ? "กำลังโหลดบริษัท..." : "เลือกบริษัท"}
              </option>
              {companies.map((item) => (
                <option key={item.Company} value={item.Company}>{item.CompanyName}</option>
              ))}
            </select>
            <span className="lcaret"><SamcoIcon name="chevR" size={14} stroke={2.4} /></span>
          </span>
        </label>

        <label className="lfield">
          <span className="ll"><SamcoIcon name="user" size={12} stroke={2} />ชื่อผู้ใช้ / รหัสพนักงาน</span>
          <input
            value={username}
            onChange={(e) => { setUsername(e.target.value); setErrorMessage(""); }}
            placeholder="เช่น napat.s หรือ EMP-1042"
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="lfield">
          <span className="ll"><SamcoIcon name="lock" size={12} stroke={2} />รหัสผ่าน</span>
          <span className="lpw">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrorMessage(""); }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPassword((current) => !current)}
              title={showPassword ? "ซ่อน" : "แสดง"}
            >
              <SamcoIcon name={showPassword ? "eyeoff" : "eye"} size={15} stroke={1.9} />
            </button>
          </span>
        </label>

        {errorMessage ? <div className="lerr"><SamcoIcon name="alert" size={12} stroke={2.2} />{errorMessage}</div> : null}

        <button type="submit" className="lbtn" disabled={submitting}>
          <SamcoIcon name="logout" size={15} stroke={2.1} style={{ transform: "scaleX(-1)" }} />
          {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <div className="lhint">ใช้บัญชีพนักงาน Sammakorn · มีปัญหาเข้าระบบ ติดต่อ IT Support</div>
      </form>

      <div className="login-foot">© {new Date().getFullYear()} Sammakorn PCL · Internal use only</div>
    </main>
  );
}
