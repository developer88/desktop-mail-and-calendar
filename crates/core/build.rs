fn main() {
    println!("cargo:rerun-if-changed=../../shared/scripts/titlebar.js");
    println!("cargo:rerun-if-changed=../../shared/scripts/unread-observer.js");
    println!("cargo:rerun-if-changed=../../shared/scripts/calendar-date-observer.js");
    println!("cargo:rerun-if-changed=../../shared/scripts/navigation-interceptor.js");
    println!("cargo:rerun-if-changed=../../shared/styles/shell.css");
    println!("cargo:rerun-if-changed=../../shared/styles/win11-theme.css");
    println!("cargo:rerun-if-changed=../../shared/styles/declutter.css");
}
