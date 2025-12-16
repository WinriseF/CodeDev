use crate::modules::screenshot::ScreenshotState;
use base64::Engine;
use image::{DynamicImage, ImageFormat}; // <--- 新增引入 DynamicImage
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
    let start = std::time::Instant::now();

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("No monitors found".to_string());
    }

    let monitor = monitors.first().unwrap();
    let width = monitor.width().map_err(|e| e.to_string())?;
    let height = monitor.height().map_err(|e| e.to_string())?;
    let scale_factor = monitor.scale_factor().map_err(|e| e.to_string())?;

    // 1. 获取原始 RGBA 图像
    let image_rgba = monitor.capture_image().map_err(|e| e.to_string())?;

    // 2. 关键修复：转换为 RGB8 (去除 Alpha 通道)
    // JPEG 不支持 RGBA，必须转为 RGB
    let image_rgb = DynamicImage::ImageRgba8(image_rgba).to_rgb8();

    // 3. 编码为 JPEG
    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    
    // 这里使用 image_rgb 进行写入
    image_rgb
        .write_to(&mut cursor, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    // 4. 存入内存 (存原始字节流即可，这里存的是 JPEG 编码后的流)
    // 注意：为了后续处理方便，如果后续需要再次编辑，可能需要重新解码
    // 但为了传输速度，目前存 JPEG 流没问题
    {
        let mut current_image = state.current_image.lock().unwrap();
        *current_image = Some(bytes.clone());
    }

    let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let base64_img = format!("data:image/jpeg;base64,{}", base64_str);

    if let Some(window) = app.get_webview_window("screenshot") {
        let _ = window.set_fullscreen(true);
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        let _ = window.show();
    }

    println!("Screenshot captured in {:?}", start.elapsed());

    Ok(CaptureResult {
        width,
        height,
        base64: base64_img,
        scale_factor: scale_factor as f64,
    })
}

#[tauri::command]
pub async fn get_current_screenshot(
    state: tauri::State<'_, ScreenshotState>,
) -> Result<CaptureResult, String> {
    let current_image = state.current_image.lock().unwrap();
    
    if let Some(bytes) = &*current_image {
        // 解码获取尺寸
        let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
        
        let base64_str = base64::engine::general_purpose::STANDARD.encode(bytes);
        let base64_img = format!("data:image/jpeg;base64,{}", base64_str);

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