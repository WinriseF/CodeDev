fn main() {
    #[cfg(windows)]
    println!("cargo:rustc-link-lib=dylib=msvcprt");
    
    tauri_build::build()
}
