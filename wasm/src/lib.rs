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

/// Write a `.d2s` character save from JSON produced by `parseD2s` (possibly edited).
#[wasm_bindgen(js_name = writeD2s)]
pub fn write_d2s(json: &str) -> Result<Vec<u8>, JsError> {
    let save: D2Save = serde_json::from_str(json).map_err(js_err)?;
    save.to_bytes().map_err(js_err)
}

/// Write a `.d2i` shared stash from JSON produced by `parseD2i` (possibly edited).
#[wasm_bindgen(js_name = writeD2i)]
pub fn write_d2i(json: &str) -> Result<Vec<u8>, JsError> {
    let stash: D2StashSave = serde_json::from_str(json).map_err(js_err)?;
    stash.to_bytes().map_err(js_err)
}
