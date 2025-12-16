use crate::modules::screenshot::ScreenshotState;
use base64::Engine;
use image::ImageFormat; // 修复：使用 ImageFormat 替代 ImageOutputFormat
use std::io::Cursor;
use tauri::{AppHandle, Manager, Runtime};
use xcap::Monitor;

#[derive(serde::Serialize, Clone)]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub base64: String,
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn capture_screen<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, ScreenshotState>,
) -> Result<CaptureResult, String> {
    // 1. 获取显示器列表
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    if monitors.is_empty() {
        return Err("No monitors found".to_string());
    }

    // 默认取第一个屏幕 (主屏)
    let monitor = monitors.first().unwrap();
    
    // 修复：xcap 0.7+ 中 width/height 返回 Result，需要处理错误
    let width = monitor.width().map_err(|e| e.to_string())?;
    let height = monitor.height().map_err(|e| e.to_string())?;
    
    // xcap 0.7+ API 调用
    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    // 2. 将 RgbaImage 转换为 PNG 字节流
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    
    // 修复：使用 ImageFormat::Png
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    // 3. 存入 State
    {
        let mut current_image = state.current_image.lock().unwrap();
        *current_image = Some(bytes.clone());
    }

    // 4. 转 Base64 返回给前端展示
    let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let base64_img = format!("data:image/png;base64,{}", base64_str);

    // 5. 激活截图窗口
    if let Some(window) = app.get_webview_window("screenshot") {
        // 确保窗口是全屏且置顶的
        let _ = window.set_fullscreen(true);
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        let _ = window.show();
    }

    Ok(CaptureResult {
        width,
        height,
        base64: base64_img,
        scale_factor: 1.0, 
    })
}

#[tauri::command]
pub async fn get_current_screenshot(
    state: tauri::State<'_, ScreenshotState>,
) -> Result<CaptureResult, String> {
    let current_image = state.current_image.lock().unwrap();
    
    if let Some(bytes) = &*current_image {
        // 为了获取宽高，我们需要临时解码一下
        let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
        
        let base64_str = base64::engine::general_purpose::STANDARD.encode(bytes);
        let base64_img = format!("data:image/png;base64,{}", base64_str);

        Ok(CaptureResult {
            width: img.width(),
            height: img.height(),
            base64: base64_img,
            scale_factor: 1.0,
        })
    } else {
        Err("No screenshot available".to_string())
    }
}