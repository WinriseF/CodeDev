use std::sync::Mutex;

// 1. 声明子模块
pub mod capture;

// 截图状态管理
pub struct ScreenshotState {
    pub current_image: Mutex<Option<Vec<u8>>>, 
}

impl Default for ScreenshotState {
    fn default() -> Self {
        Self {
            current_image: Mutex::new(None),
        }
    }
}
