#!/usr/bin/env bash
# Build DOOM for pi-doom using doomgeneric and Emscripten
# 使用 doomgeneric 和 Emscripten 为 pi-doom 构建 DOOM。
# 文件职责：获取 doomgeneric 源码并把定制平台层编译成 Node 可加载的 WebAssembly 模块。
# 技术维度：使用 Bash、Git、Emscripten emcc 和大量 C 源文件完成 WASM 构建。
# 产品维度：为终端 DOOM 覆盖层生成运行时脚本和 wasm 资源。
# 逻辑维度：校验 emcc，按需克隆源码，复制平台文件，读取分辨率并执行编译。
# 关键边界：需要网络、Git 和 Emscripten；会在项目目录克隆源码并覆盖构建产物。
# 新手阅读建议：先确认依赖检查和目录变量，再看分辨率参数及 emcc 导出项。

set -e

 # SCRIPT_DIR 是当前构建脚本所在目录。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# PROJECT_ROOT 是 doom-overlay 扩展根目录。
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# DOOM_DIR 是 DOOM 平台源码目录。
DOOM_DIR="$PROJECT_ROOT/doom"
# BUILD_DIR 是最终 JavaScript 和 WASM 输出目录。
BUILD_DIR="$PROJECT_ROOT/doom/build"

echo "=== pi-doom Build Script ==="

# Check for emcc
# 检查 Emscripten 编译器是否可用。
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found!"
    echo ""
    echo "Install via Homebrew:"
    echo "  brew install emscripten"
    echo ""
    echo "Or manually:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git ~/emsdk"
    echo "  cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest"
    echo "  source ~/emsdk/emsdk_env.sh"
    exit 1
fi

# Clone doomgeneric if not present
# 缺少 doomgeneric 源码时从 GitHub 克隆。
if [ ! -d "$DOOM_DIR/doomgeneric" ]; then
    echo "Cloning doomgeneric..."
    cd "$DOOM_DIR"
    git clone https://github.com/ozkl/doomgeneric.git
fi

# Create build directory
# 创建构建输出目录。
mkdir -p "$BUILD_DIR"

# Copy our platform file
# 把项目定制平台适配 C 文件复制到上游源码目录。
cp "$DOOM_DIR/doomgeneric_pi.c" "$DOOM_DIR/doomgeneric/doomgeneric/"

echo "Compiling DOOM to WebAssembly..."
cd "$DOOM_DIR/doomgeneric/doomgeneric"

# Resolution - 640x400 is doomgeneric default, good balance of speed/quality
# 分辨率默认 640×400，在速度与画质之间平衡。
# RESX 和 RESY 可由环境变量覆盖，分别表示横向和纵向像素。
RESX=${DOOM_RESX:-640}
RESY=${DOOM_RESY:-400}

echo "Resolution: ${RESX}x${RESY}"

# Compile with Emscripten (no sound)
# 使用 Emscripten 编译无声音版本，并导出覆盖层所需函数和运行时方法。
emcc -O2 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="['_doomgeneric_Create','_doomgeneric_Tick','_DG_GetFrameBuffer','_DG_GetScreenWidth','_DG_GetScreenHeight','_DG_PushKeyEvent','_malloc','_free']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue','FS']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=33554432 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createDoomModule" \
    -s ENVIRONMENT='node' \
    -s FILESYSTEM=1 \
    -s FORCE_FILESYSTEM=1 \
    -s EXIT_RUNTIME=0 \
    -s NO_EXIT_RUNTIME=1 \
    -DDOOMGENERIC_RESX="$RESX" \
    -DDOOMGENERIC_RESY="$RESY" \
    -I. \
    am_map.c \
    d_event.c \
    d_items.c \
    d_iwad.c \
    d_loop.c \
    d_main.c \
    d_mode.c \
    d_net.c \
    doomdef.c \
    doomgeneric.c \
    doomgeneric_pi.c \
    doomstat.c \
    dstrings.c \
    f_finale.c \
    f_wipe.c \
    g_game.c \
    hu_lib.c \
    hu_stuff.c \
    i_cdmus.c \
    i_input.c \
    i_endoom.c \
    i_joystick.c \
    i_scale.c \
    i_sound.c \
    i_system.c \
    i_timer.c \
    i_video.c \
    icon.c \
    info.c \
    m_argv.c \
    m_bbox.c \
    m_cheat.c \
    m_config.c \
    m_controls.c \
    m_fixed.c \
    m_menu.c \
    m_misc.c \
    m_random.c \
    memio.c \
    p_ceilng.c \
    p_doors.c \
    p_enemy.c \
    p_floor.c \
    p_inter.c \
    p_lights.c \
    p_map.c \
    p_maputl.c \
    p_mobj.c \
    p_plats.c \
    p_pspr.c \
    p_saveg.c \
    p_setup.c \
    p_sight.c \
    p_spec.c \
    p_switch.c \
    p_telept.c \
    p_tick.c \
    p_user.c \
    r_bsp.c \
    r_data.c \
    r_draw.c \
    r_main.c \
    r_plane.c \
    r_segs.c \
    r_sky.c \
    r_things.c \
    s_sound.c \
    sha1.c \
    sounds.c \
    st_lib.c \
    st_stuff.c \
    statdump.c \
    tables.c \
    v_video.c \
    w_checksum.c \
    w_file.c \
    w_file_stdc.c \
    w_main.c \
    w_wad.c \
    wi_stuff.c \
    z_zone.c \
    dummy.c \
    -o "$BUILD_DIR/doom.js"

echo ""
echo "Build complete!"
echo "Output: $BUILD_DIR/doom.js and $BUILD_DIR/doom.wasm"
