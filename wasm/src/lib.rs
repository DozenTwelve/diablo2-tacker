use d2s::{D2Save, D2StashSave};
use wasm_bindgen::prelude::*;

fn js_err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

/// Parse a `.d2s` character save into JSON.
#[wasm_bindgen(js_name = parseD2s)]
pub fn parse_d2s(bytes: &[u8]) -> Result<String, JsError> {
    let save = D2Save::from_bytes(bytes).map_err(js_err)?;
    serde_json::to_string(&save).map_err(js_err)
}

/// Parse a `.d2i` shared stash into JSON.
#[wasm_bindgen(js_name = parseD2i)]
pub fn parse_d2i(bytes: &[u8]) -> Result<String, JsError> {
    let stash = D2StashSave::from_bytes(bytes).map_err(js_err)?;
    serde_json::to_string(&stash).map_err(js_err)
}
