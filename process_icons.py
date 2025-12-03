from PIL import Image
import os
import shutil

# Source path (from the generate_image output)
source_path = r"C:/Users/kumar/.gemini/antigravity/brain/f694cb56-12d1-4c27-94e7-4a49a36cab5e/ums_icon_1764678025689.png"
public_dir = r"C:\Users\kumar\.gemini\antigravity\scratch\UMS\frontend\public"

if not os.path.exists(source_path):
    print(f"Error: Source file not found at {source_path}")
    exit(1)

try:
    img = Image.open(source_path)
    
    # Save 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save(os.path.join(public_dir, "pwa-192x192.png"))
    print("Saved pwa-192x192.png")
    
    # Save 512x512
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save(os.path.join(public_dir, "pwa-512x512.png"))
    print("Saved pwa-512x512.png")
    
    # Save favicon (32x32 is standard, but we can just use the 192 one or resize)
    img_64 = img.resize((64, 64), Image.Resampling.LANCZOS)
    img_64.save(os.path.join(public_dir, "favicon.ico"), format='ICO')
    print("Saved favicon.ico")

except Exception as e:
    print(f"Error processing image: {e}")
