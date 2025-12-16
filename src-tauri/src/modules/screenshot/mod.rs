use std::sync::Mutex;

pub mod capture;

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