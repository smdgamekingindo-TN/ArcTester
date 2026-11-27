import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthScreen from "./AuthScreen";
import { AGE_GATE_VERSION, CONSENT_NOTICE_VERSION, PRIVACY_NOTICE_VERSION, TERMS_VERSION } from "./legalVersions";
function renderAuth(overrides: Partial<React.ComponentProps<typeof AuthScreen>> = {}) {
 const props={email:"",password:"",register:false,busy:false,error:"",academicProfile:{fullName:"",collegeName:"",collegeCode:"",registrationNumber:"",branchName:"",branchCode:""},onAcademicChange:vi.fn(),onEmailChange:vi.fn(),onPasswordChange:vi.fn(),onRegisterChange:vi.fn(),onAuthenticate:vi.fn(),onRequestPasswordReset:vi.fn(),onResetPassword:vi.fn(),...overrides};
 render(<AuthScreen {...props}/>);return props;
}
describe("AuthScreen",()=>{
 it("renders sign in and delegates fields and submit",()=>{const props=renderAuth();expect(screen.getByRole("heading",{name:"Welcome back"})).toBeTruthy();fireEvent.change(screen.getByLabelText("Email address"),{target:{value:"student@example.test"}});fireEvent.change(screen.getByLabelText("Password"),{target:{value:"secret123"}});fireEvent.submit(screen.getByRole("button",{name:"Sign in"}).closest("form")!);expect(props.onEmailChange).toHaveBeenCalledWith("student@example.test");expect(props.onPasswordChange).toHaveBeenCalledWith("secret123");expect(props.onAuthenticate).toHaveBeenCalledTimes(1)});
 it("shows registration number instead of a college or postal PIN field and exposes only six branches",()=>{renderAuth({register:true});expect(screen.getByRole("heading",{name:"Create your account"})).toBeTruthy();expect(screen.getByLabelText("Diploma registration number")).toBeTruthy();expect(screen.queryByLabelText("College PIN / institute code")).toBeNull();expect(screen.queryByLabelText("Postal PIN (optional)")).toBeNull();expect(screen.getByRole("combobox",{name:"College / Polytechnic"})).toBeTruthy();const branch=screen.getByRole("combobox",{name:"Diploma branch (6 main branches)"});fireEvent.focus(branch);const list=screen.getByRole("listbox",{name:"Diploma branch (6 main branches)"});expect(within(list).getAllByRole("option")).toHaveLength(6);expect(screen.getByText("Security check")).toBeTruthy();expect(screen.getByLabelText("Full name")).toBeTruthy();expect(screen.getByRole("checkbox",{name:"I confirm I am 18 or older"})).toBeTruthy();expect(screen.getByRole("checkbox",{name:"I agree to the Terms and Conditions"})).toBeTruthy();expect(screen.getByRole("checkbox",{name:"I consent to personal data processing described in the Privacy Notice"})).toBeTruthy();expect(screen.getByRole("link",{name:"Terms & Conditions"}).getAttribute("href")).toBe("/terms-and-conditions.html");expect(screen.getByRole("link",{name:"Privacy Notice"}).getAttribute("href")).toBe("/privacy-policy.html");expect(screen.getByText(/administrator will review your account/i)).toBeTruthy()});
 it("extracts college and branch codes from a diploma registration number",()=>{const props=renderAuth({register:true});fireEvent.change(screen.getByLabelText("Diploma registration number"),{target:{value:"24010-CM-053"}});expect(props.onAcademicChange).toHaveBeenCalledWith("registrationNumber","24010-CM-053");expect(props.onAcademicChange).toHaveBeenCalledWith("collegeCode","010");expect(props.onAcademicChange).toHaveBeenCalledWith("branchCode","CM");expect(props.onAcademicChange).toHaveBeenCalledWith("branchName","Computer Engineering (CME)");expect(props.onAcademicChange).toHaveBeenCalledWith("collegeName","Andhra Polytechnic, Kakinada")});
 it("allows a custom college name but restricts branches to the six main options",()=>{const props=renderAuth({register:true});fireEvent.change(screen.getByRole("combobox",{name:"College / Polytechnic"}),{target:{value:"My Unlisted Polytechnic"}});fireEvent.change(screen.getByRole("combobox",{name:"Diploma branch (6 main branches)"}),{target:{value:"Computer Engineering (CME)"}});expect(props.onAcademicChange).toHaveBeenCalledWith("collegeName","My Unlisted Polytechnic");expect(props.onAcademicChange).toHaveBeenCalledWith("branchName","Computer Engineering (CME)");expect(props.onAcademicChange).toHaveBeenCalledWith("branchCode","CM")});
 it("autofills college code from a selected college",()=>{const props=renderAuth({register:true});fireEvent.change(screen.getByRole("combobox",{name:"College / Polytechnic"}),{target:{value:"Andhra Polytechnic, Kakinada"}});expect(props.onAcademicChange).toHaveBeenCalledWith("collegeCode","010")});
 it("toggles password visibility",()=>{renderAuth();const password=screen.getByLabelText("Password") as HTMLInputElement;fireEvent.change(password,{target:{value:"secret123"}});fireEvent.click(screen.getByRole("button",{name:"Show password"}));expect(password.type).toBe("text");fireEvent.click(screen.getByRole("button",{name:"Hide password"}));expect(password.type).toBe("password")});
 it("shows registration password strength and requirement feedback",()=>{renderAuth({register:true,password:"Abcd123!"});expect(screen.getByRole("progressbar",{name:"Password strength"}).getAttribute("aria-valuenow")).toBe("4");expect(screen.getByText("Strong")).toBeTruthy();expect(screen.getByText("At least 8 characters")).toBeTruthy();expect(screen.getByText("Contains a symbol")).toBeTruthy()});
 it("disables submit while busy and shows API errors",()=>{renderAuth({busy:true,error:"The invitation has expired."});expect(screen.getByRole("button",{name:"Please wait…"}).hasAttribute("disabled")).toBe(true);expect(screen.getByText("The invitation has expired.")).toBeTruthy()});
 it("delegates switching to registration",()=>{const props=renderAuth();fireEvent.click(screen.getByRole("button",{name:"New student? Create an account"}));expect(props.onRegisterChange).toHaveBeenCalledWith(true)});
 it("opens the forgot password form",()=>{const props=renderAuth();fireEvent.click(screen.getByRole("button",{name:"Forgot password?"}));expect(screen.getByRole("button",{name:"Send reset link"})).toBeTruthy();expect(props.onRequestPasswordReset).not.toHaveBeenCalled()});
 it("submits a reset token with a replacement password and recovery code",()=>{const props=renderAuth({passwordResetToken:"reset-token-12345678901234567890123456789012"});fireEvent.change(screen.getByLabelText(/New password/),{target:{value:"replacement-password-123"}});fireEvent.change(screen.getByLabelText(/Authenticator \/ recovery code/),{target:{value:"recovery-code"}});fireEvent.submit(screen.getByRole("button",{name:"Reset password"}).closest("form")!);expect(props.onResetPassword).toHaveBeenCalledWith("reset-token-12345678901234567890123456789012","replacement-password-123","recovery-code")});
 it("submits explicit legal consent versions after all required checks are accepted",async()=>{
  const props=renderAuth({
    register:true,
    academicProfile:{fullName:"Test Student",collegeName:"Unlisted Polytechnic",collegeCode:"999",registrationNumber:"24999-CM-053",branchName:"Computer Engineering (CME)",branchCode:"CM"},
    onCaptchaLoad:vi.fn(async()=>({svg:"",token:"captcha-token"})),
  });
  await waitFor(()=>expect(props.onCaptchaLoad).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("CAPTCHA characters"),{target:{value:"ABCDE"}});
  fireEvent.click(screen.getByRole("checkbox",{name:"I confirm I am 18 or older"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"I agree to the Terms and Conditions"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"I consent to personal data processing described in the Privacy Notice"}));
  fireEvent.submit(screen.getByRole("button",{name:"Request account"}).closest("form")!);
  await waitFor(()=>expect(props.onAuthenticate).toHaveBeenCalledWith("captcha-token:ABCDE",{
    adultAttestation:true,termsAccepted:true,privacyConsent:true,
    termsVersion:TERMS_VERSION,privacyNoticeVersion:PRIVACY_NOTICE_VERSION,
    consentNoticeVersion:CONSENT_NOTICE_VERSION,ageGateVersion:AGE_GATE_VERSION,
  }));
 });

});
