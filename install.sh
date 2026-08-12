#!/bin/bash

REPO="sadid56/HyperDisk"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons"
APP_NAME="hyperdisk"
DISPLAY_NAME="HyperDisk"
ICON_URL="https://raw.githubusercontent.com/${REPO}/main/src/assets/icon.svg"

OS_TYPE=$(uname)

show_help() {
    echo "HyperDisk Installer Script"
    echo "Usage:"
    echo "  install.sh [option]"
    echo ""
    echo "Options:"
    echo "  (no option)  Install or update to the latest version"
    echo "  --uninstall  Uninstall HyperDisk from the system"
    echo "  --help, -h   Show this help message"
}

uninstall_linux() {
    echo "Uninstalling ${DISPLAY_NAME} from Linux..."
    
    # Remove binary executable
    if [ -f "$BIN_DIR/$APP_NAME" ]; then
        rm "$BIN_DIR/$APP_NAME"
        echo "Removed binary from $BIN_DIR/$APP_NAME"
    fi
    
    # Remove desktop shortcut entry
    if [ -f "$DESKTOP_DIR/$APP_NAME.desktop" ]; then
        rm "$DESKTOP_DIR/$APP_NAME.desktop"
        echo "Removed desktop entry from $DESKTOP_DIR/$APP_NAME.desktop"
    fi
    
    # Remove application icon file
    if [ -f "$ICON_DIR/$APP_NAME.svg" ]; then
        rm "$ICON_DIR/$APP_NAME.svg"
        echo "Removed icon from $ICON_DIR/$APP_NAME.svg"
    fi
    
    # Update local desktop databases
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1
    fi
    
    echo "${DISPLAY_NAME} uninstalled successfully!"
}

uninstall_mac() {
    echo "Uninstalling ${DISPLAY_NAME} from macOS..."
    if [ -d "/Applications/HyperDisk.app" ]; then
        rm -rf "/Applications/HyperDisk.app"
        echo "Removed /Applications/HyperDisk.app"
    fi
    echo "${DISPLAY_NAME} uninstalled successfully!"
}

uninstall() {
    if [ "$OS_TYPE" = "Darwin" ]; then
        uninstall_mac
    else
        uninstall_linux
    fi
}

install_linux() {
    # Ensure directory structure exists for Linux
    mkdir -p "$BIN_DIR"
    mkdir -p "$DESKTOP_DIR"
    mkdir -p "$ICON_DIR"

    echo "Checking latest release of ${DISPLAY_NAME} on GitHub..."
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest")
    VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/')
    
    # Fallback if GitHub API rate limit is exceeded
    if [ -z "$VERSION" ]; then
        VERSION=$(curl -sI "https://github.com/${REPO}/releases/latest" | grep -i '^location:' | tr -d '\r' | sed -E 's/.*\/tag\/([^[:space:]]+).*/\1/')
    fi
    
    if [ -z "$VERSION" ]; then
        echo "Error: Could not retrieve latest version from GitHub."
        exit 1
    fi
    
    # Strip any leading 'v' prefix
    CLEAN_VERSION=$(echo "$VERSION" | sed 's/^v//')
    echo "Latest version found: ${VERSION}"

    # Search for compiled package assets (prefer .deb for native library compatibility, then .tar.gz, then .AppImage)
    DOWNLOAD_URL=""
    IS_DEB=false
    IS_TAR_GZ=false

    # Check for available helper tools
    HAS_AR_AND_TAR=false
    if command -v ar >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
        HAS_AR_AND_TAR=true
    fi

    # 1. Look up assets from API response
    if echo "$LATEST_RELEASE" | grep -q '"browser_download_url"'; then
        if [ "$HAS_AR_AND_TAR" = true ]; then
            DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*' | grep -i "\.deb" | head -n 1 | cut -d'"' -f4)
            if [ -n "$DOWNLOAD_URL" ]; then
                IS_DEB=true
            fi
        fi
        if [ -z "$DOWNLOAD_URL" ]; then
            DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*' | grep -i "\.tar\.gz" | grep -iv "source" | head -n 1 | cut -d'"' -f4)
            if [ -n "$DOWNLOAD_URL" ]; then
                IS_TAR_GZ=true
            fi
        fi
        if [ -z "$DOWNLOAD_URL" ]; then
            DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*' | grep -i "\.AppImage" | head -n 1 | cut -d'"' -f4)
        fi
    fi

    # 2. Fallback to scraping the expanded assets page if API rate limited
    if [ -z "$DOWNLOAD_URL" ]; then
        ASSET_PATHS=$(curl -sL "https://github.com/${REPO}/releases/expanded_assets/${VERSION}" | grep -o "/${REPO}/releases/download/[^\"]*")
        if [ "$HAS_AR_AND_TAR" = true ]; then
            RELATIVE_URL=$(echo "$ASSET_PATHS" | grep -i "\.deb" | head -n 1)
            if [ -n "$RELATIVE_URL" ]; then
                IS_DEB=true
                DOWNLOAD_URL="https://github.com${RELATIVE_URL}"
            fi
        fi
        if [ -z "$DOWNLOAD_URL" ]; then
            RELATIVE_URL=$(echo "$ASSET_PATHS" | grep -i "\.tar\.gz" | grep -iv "source" | head -n 1)
            if [ -n "$RELATIVE_URL" ]; then
                IS_TAR_GZ=true
                DOWNLOAD_URL="https://github.com${RELATIVE_URL}"
            fi
        fi
        if [ -z "$DOWNLOAD_URL" ]; then
            RELATIVE_URL=$(echo "$ASSET_PATHS" | grep -i "\.AppImage" | head -n 1)
            if [ -n "$RELATIVE_URL" ]; then
                DOWNLOAD_URL="https://github.com${RELATIVE_URL}"
            fi
        fi
    fi

    if [ -z "$DOWNLOAD_URL" ]; then
        echo "Error: Could not find suitable release asset (.deb, .tar.gz, or .AppImage) for version ${VERSION}."
        exit 1
    fi
    ASSET_NAME=$(basename "$DOWNLOAD_URL")

    if [ "$IS_DEB" = true ]; then
        echo "Downloading ${ASSET_NAME} (Debian package extraction)..."
        TEMP_DIR=$(mktemp -d)
        TEMP_FILE="$TEMP_DIR/package.deb"
        curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
        if [ $? -ne 0 ] || [ ! -s "$TEMP_FILE" ]; then
            echo "Error: Failed to download .deb package."
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        echo "Extracting from .deb package..."
        DATA_FILE=$(ar t "$TEMP_FILE" | grep '^data.tar')
        if [ -z "$DATA_FILE" ]; then
            echo "Error: Could not locate data archive in .deb package."
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        TAR_OPTS="-xf"
        if echo "$DATA_FILE" | grep -q '\.gz$'; then
            TAR_OPTS="-xzf"
        elif echo "$DATA_FILE" | grep -q '\.xz$'; then
            TAR_OPTS="-xJf"
        elif echo "$DATA_FILE" | grep -q '\.zst$'; then
            TAR_OPTS="--zstd -xf"
        fi

        mkdir -p "$TEMP_DIR/extracted"
        ar p "$TEMP_FILE" "$DATA_FILE" | tar $TAR_OPTS - -C "$TEMP_DIR/extracted"
        if [ $? -ne 0 ] || [ ! -f "$TEMP_DIR/extracted/usr/bin/hyperdisk" ]; then
            echo "Error: Failed to extract binary from .deb package."
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        # Install binary
        mv "$TEMP_DIR/extracted/usr/bin/hyperdisk" "$BIN_DIR/$APP_NAME"
        chmod +x "$BIN_DIR/$APP_NAME"
        echo "Installed native binary to $BIN_DIR/$APP_NAME"

        # Install .desktop entry from the package (if bundled)
        DEB_DESKTOP=$(find "$TEMP_DIR/extracted" -path "*/share/applications/*.desktop" | head -n 1)
        if [ -n "$DEB_DESKTOP" ]; then
            # Patch Exec and Icon paths to match our install locations
            sed -e "s|^Exec=.*|Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 ${BIN_DIR}/${APP_NAME}|" \
                -e "s|^Icon=.*|Icon=${APP_NAME}|" \
                "$DEB_DESKTOP" > "$DESKTOP_DIR/$APP_NAME.desktop"
            chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"
            echo "Installed desktop entry from package to $DESKTOP_DIR/$APP_NAME.desktop"
        else
            # Fallback: create desktop entry manually
            echo "Creating desktop shortcut entry..."
            cat > "$DESKTOP_DIR/$APP_NAME.desktop" <<DEOF
[Desktop Entry]
Name=${DISPLAY_NAME}
Comment=Disk Storage Analyzer
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 ${BIN_DIR}/${APP_NAME}
Icon=${APP_NAME}
Terminal=false
Type=Application
Categories=Utility;System;
DEOF
            chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"
        fi

        # Install icons from the package (if bundled)
        DEB_ICONS_FOUND=false
        while IFS= read -r icon_file; do
            [ -z "$icon_file" ] && continue
            # Reconstruct the destination path under ~/.local/share/icons/
            REL_PATH=$(echo "$icon_file" | sed "s|$TEMP_DIR/extracted/usr/share/||")
            DEST_PATH="$HOME/.local/share/$REL_PATH"
            mkdir -p "$(dirname "$DEST_PATH")"
            cp "$icon_file" "$DEST_PATH"
            DEB_ICONS_FOUND=true
        done <<< "$(find "$TEMP_DIR/extracted" -path "*/share/icons/*" -type f 2>/dev/null)"

        if [ "$DEB_ICONS_FOUND" = true ]; then
            echo "Installed icons from package"
            # Update icon caches
            if command -v gtk-update-icon-cache >/dev/null 2>&1; then
                for theme_dir in "$HOME/.local/share/icons/"*/; do
                    gtk-update-icon-cache -f -t "$theme_dir" >/dev/null 2>&1 || true
                done
            fi
        else
            # Fallback: download icon from GitHub
            echo "Downloading icon..."
            curl -s -L -o "$ICON_DIR/$APP_NAME.svg" "$ICON_URL"
            if [ $? -eq 0 ]; then
                echo "Installed icon to $ICON_DIR/$APP_NAME.svg"
            else
                echo "Warning: Failed to download icon."
            fi
        fi

        rm -rf "$TEMP_DIR"

    elif [ "$IS_TAR_GZ" = true ]; then
        echo "Downloading ${ASSET_NAME}..."
        TEMP_DIR=$(mktemp -d)
        TEMP_FILE="$TEMP_DIR/archive.tar.gz"
        curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
        if [ $? -ne 0 ] || [ ! -s "$TEMP_FILE" ]; then
            echo "Error: Failed to download archive."
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        echo "Extracting ${ASSET_NAME}..."
        tar -xzf "$TEMP_FILE" -C "$TEMP_DIR"
        
        # Look for executable binary file inside extracted folder
        BINARY_PATH=$(find "$TEMP_DIR" -type f -executable | head -n 1)
        if [ -z "$BINARY_PATH" ]; then
            # Fallback to any file if permissions are not set inside archive
            BINARY_PATH=$(find "$TEMP_DIR" -type f ! -name "archive.tar.gz" | head -n 1)
        fi

        if [ -z "$BINARY_PATH" ]; then
            echo "Error: Could not find binary inside extracted archive."
            rm -rf "$TEMP_DIR"
            exit 1
        fi

        # Install executable
        mv "$BINARY_PATH" "$BIN_DIR/$APP_NAME"
        chmod +x "$BIN_DIR/$APP_NAME"
        rm -rf "$TEMP_DIR"
        echo "Installed binary to $BIN_DIR/$APP_NAME"

        # For .tar.gz and .AppImage, create desktop entry and icon manually
        echo "Downloading icon..."
        curl -s -L -o "$ICON_DIR/$APP_NAME.svg" "$ICON_URL"
        if [ $? -eq 0 ]; then
            echo "Installed icon to $ICON_DIR/$APP_NAME.svg"
        else
            echo "Warning: Failed to download icon."
        fi

        echo "Creating desktop shortcut entry..."
        cat > "$DESKTOP_DIR/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Name=${DISPLAY_NAME}
Comment=Disk Storage Analyzer
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 ${BIN_DIR}/${APP_NAME}
Icon=${ICON_DIR}/${APP_NAME}.svg
Terminal=false
Type=Application
Categories=Utility;System;
EOF
        chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"

    else
        echo "Downloading ${ASSET_NAME} (AppImage fallback)..."
        TEMP_FILE=$(mktemp)
        curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
        if [ $? -ne 0 ] || [ ! -s "$TEMP_FILE" ]; then
            echo "Error: Failed to download AppImage."
            rm -f "$TEMP_FILE"
            exit 1
        fi
        
        # Install AppImage directly as the executable binary
        mv "$TEMP_FILE" "$BIN_DIR/$APP_NAME"
        chmod +x "$BIN_DIR/$APP_NAME"
        echo "Installed binary to $BIN_DIR/$APP_NAME"

        # For AppImage, create desktop entry and icon manually
        echo "Downloading icon..."
        curl -s -L -o "$ICON_DIR/$APP_NAME.svg" "$ICON_URL"
        if [ $? -eq 0 ]; then
            echo "Installed icon to $ICON_DIR/$APP_NAME.svg"
        else
            echo "Warning: Failed to download icon."
        fi

        echo "Creating desktop shortcut entry..."
        cat > "$DESKTOP_DIR/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Name=${DISPLAY_NAME}
Comment=Disk Storage Analyzer
Exec=env WEBKIT_DISABLE_DMABUF_RENDERER=1 ${BIN_DIR}/${APP_NAME}
Icon=${ICON_DIR}/${APP_NAME}.svg
Terminal=false
Type=Application
Categories=Utility;System;
EOF
        chmod +x "$DESKTOP_DIR/$APP_NAME.desktop"
    fi

    # Update desktop file list databases
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1
    fi

    # Alert user if their PATH is missing $BIN_DIR
    case :$PATH: in
        *:$BIN_DIR:*) ;;
        *) echo "Note: Please ensure '$BIN_DIR' is added to your shell PATH (e.g. inside ~/.bashrc or ~/.zshrc)." ;;
    esac

    echo "${DISPLAY_NAME} ${VERSION} installed/updated successfully on Linux!"
}

install_mac() {
    echo "Checking latest release of ${DISPLAY_NAME} on GitHub..."
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest")
    VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/')
    
    # Fallback if GitHub API rate limit is exceeded
    if [ -z "$VERSION" ]; then
        VERSION=$(curl -sI "https://github.com/${REPO}/releases/latest" | grep -i '^location:' | tr -d '\r' | sed -E 's/.*\/tag\/([^[:space:]]+).*/\1/')
    fi
    
    if [ -z "$VERSION" ]; then
        echo "Error: Could not retrieve latest version from GitHub."
        exit 1
    fi
    
    echo "Latest version found: ${VERSION}"

    # Search for compiled dmg asset
    DOWNLOAD_URL=""
    if echo "$LATEST_RELEASE" | grep -q '"browser_download_url"'; then
        DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*' | grep -i "\.dmg" | head -n 1 | cut -d'"' -f4)
    fi
    
    # Fallback to scraping the expanded assets page if API rate limited
    if [ -z "$DOWNLOAD_URL" ]; then
        RELATIVE_URL=$(curl -sL "https://github.com/${REPO}/releases/expanded_assets/${VERSION}" | grep -o "/${REPO}/releases/download/[^\"]*" | grep -i "\.dmg" | head -n 1)
        if [ -n "$RELATIVE_URL" ]; then
            DOWNLOAD_URL="https://github.com${RELATIVE_URL}"
        fi
    fi
    
    if [ -z "$DOWNLOAD_URL" ]; then
        echo "Error: Could not find macOS .dmg release asset for version ${VERSION}."
        exit 1
    fi

    ASSET_NAME=$(basename "$DOWNLOAD_URL")
    echo "Downloading ${ASSET_NAME}..."
    TEMP_DIR=$(mktemp -d)
    TEMP_FILE="$TEMP_DIR/archive.dmg"
    
    curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"
    if [ $? -ne 0 ] || [ ! -s "$TEMP_FILE" ]; then
        echo "Error: Failed to download DMG."
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    echo "Mounting ${ASSET_NAME}..."
    # Mount DMG and extract the mount point
    MOUNT_INFO=$(hdiutil mount -nobrowse "$TEMP_FILE" | grep "/Volumes/")
    MOUNT_POINT=$(echo "$MOUNT_INFO" | grep -o '/Volumes/[^ ]*')

    if [ -z "$MOUNT_POINT" ]; then
        # Fallback if no mount point matches regex exactly
        MOUNT_POINT="/Volumes/HyperDisk"
        hdiutil mount -nobrowse "$TEMP_FILE" >/dev/null 2>&1
    fi

    if [ ! -d "$MOUNT_POINT" ]; then
        echo "Error: Failed to mount DMG."
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    echo "Mounted at: $MOUNT_POINT"
    
    # Find .app bundle inside mount
    APP_BUNDLE=$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" | head -n 1)
    
    if [ -z "$APP_BUNDLE" ]; then
        echo "Error: Could not find HyperDisk.app inside the mounted DMG."
        hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    echo "Installing ${DISPLAY_NAME} to /Applications..."
    # Remove existing app if present
    if [ -d "/Applications/HyperDisk.app" ]; then
        rm -rf "/Applications/HyperDisk.app"
    fi
    
    cp -R "$APP_BUNDLE" "/Applications/"
    
    # Remove quarantine attributes to bypass macOS Gatekeeper
    if command -v xattr >/dev/null 2>&1; then
        echo "Removing quarantine attributes..."
        xattr -cr "/Applications/HyperDisk.app"
    fi

    # Re-sign the app locally to ensure macOS TCC/FDA respects permissions
    if command -v codesign >/dev/null 2>&1; then
        echo "Signing app locally for macOS security..."
        codesign --force --deep --sign - "/Applications/HyperDisk.app" >/dev/null 2>&1 || true
    fi
    
    echo "Detaching DMG..."
    hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1
    rm -rf "$TEMP_DIR"

    echo "${DISPLAY_NAME} ${VERSION} installed/updated successfully in /Applications!"
    echo "Note: On first launch, you may need to grant Full Disk Access permissions in System Settings."
}

install() {
    if [ "$OS_TYPE" = "Darwin" ]; then
        install_mac
    else
        install_linux
    fi
}

# Parse Command Arguments
case "$1" in
    --uninstall)
        uninstall
        ;;
    --help|-h)
        show_help
        ;;
    *)
        if [ -n "$1" ]; then
            echo "Unknown option: $1"
            show_help
            exit 1
        fi
        install
        ;;
esac
