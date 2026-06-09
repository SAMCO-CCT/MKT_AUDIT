"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type CompanyOption = {
  Company: string;
  CompanyName: string;
};

function BuildingIcon() {
  return (
    <svg className="login-field-icon" viewBox="0 0 24 24" fill="none">
      <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 21V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="2" />
      <path d="M8 9h2M8 13h2M8 17h2M12 9h2M12 13h2M12 17h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="login-field-icon" viewBox="0 0 24 24" fill="none">
      <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="login-field-icon" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="login-eye-icon" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="login-button-icon" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      loadCompanies();
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

    if (!username || !password) {
      setErrorMessage("กรุณากรอก username และ password");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        company,
        companyName,
        username,
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
    <main className="smk-login-page">
      <section className="smk-login-panel">
        <div className="smk-login-brand-row">
          <div className="smk-login-logo">S</div>

          <div>
            <div className="smk-login-brand-line">
              <span className="smk-login-brand-name">SAMMAKORN</span>
              {/* <span className="smk-login-badge">EST. 1974</span> */}
            </div>
            <div className="smk-login-brand-subtitle">สมายใจที่ได้อยู่บ้าน</div>
          </div>
        </div>

        <div className="smk-login-heading">
          <h1>เข้าสู่ระบบ</h1>
          <p>กรุณาระบุบริษัท บัญชีผู้ใช้งาน และรหัสผ่านเพื่อเข้าทำงานในระบบ</p>
        </div>

        {errorMessage ? <div className="smk-login-alert">{errorMessage}</div> : null}

        <form onSubmit={submitLogin} className="smk-login-form">
          <div className="smk-login-field">
            <label>
              <BuildingIcon />
              เลือกบริษัท (COMPANY)
            </label>

            <div className="smk-select-wrap">
              <select
                value={company}
                disabled={loadingCompanies}
                onChange={(e) => {
                  const selectedCompany = e.target.value;
                  const selected = companies.find(
                    (item) => item.Company === selectedCompany
                  );

                  setCompany(selectedCompany);
                  setCompanyName(selected?.CompanyName || selectedCompany);
                }}
              >
                <option value="">
                  {loadingCompanies ? "กำลังโหลดบริษัท..." : "-- กรุณาเลือกบริษัทในเครือ --"}
                </option>

                {companies.map((item) => (
                  <option key={item.Company} value={item.Company}>
                    {item.CompanyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="smk-login-field">
            <label>
              <UserIcon />
              ชื่อผู้ใช้งาน (USERNAME)
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งาน หรือ รหัสพนักงาน"
              autoComplete="username"
            />
          </div>

          <div className="smk-login-field">
            <label>
              <LockIcon />
              รหัสผ่าน (PASSWORD)
            </label>

            <div className="smk-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
              />

              <button
                type="button"
                className={`smk-eye-button${showPassword ? " active" : ""}`}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                <EyeIcon />
              </button>
            </div>
          </div>

          <button className="smk-login-submit" type="submit" disabled={submitting}>
            <span>{submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
            <ArrowRightIcon />
          </button>
        </form>
      </section>
    </main>
  );
}