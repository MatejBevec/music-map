for %%a in ("track_images\*.jpg") do ffmpeg -i "%%a" -vf scale=64:64  -c:a copy "resized_images\%%~na.jpg"

pause