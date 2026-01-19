# anki-renderer

Anki card template renderer compiled to WebAssembly.

## Status

Work in progress. See [issues](https://github.com/Gilbetrar/anki-renderer/issues) for roadmap.

## Development

### Prerequisites

- Rust (stable)
- wasm-pack: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`

### Build

```bash
# Build Rust library
cargo build

# Build WASM package
wasm-pack build --target web --out-dir pkg
```

### Test

```bash
cargo test
```

## License

MIT
