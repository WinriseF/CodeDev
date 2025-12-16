use std::sync::Mutex;

pub mod capture;

pub struct ScreenshotState {
    // 使用 Mutex 在内存中安全地存储图片二进制数据
    // Option<Vec<u8>>: Some(data) 表示有截图，None 表示无
    pub current_image: Mutex<Option<Vec<u8>>>, 
}

impl Default for ScreenshotState {
    fn default() -> Self {
        Self {
            current_image: Mutex::new(None),
        }
    }
}