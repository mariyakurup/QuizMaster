@echo off
echo ========================================
echo   QUIZMASTER - Starting Server
echo ========================================
echo.
cd /d "%~dp0backend"
echo Installing required packages...
pip install -r requirements.txt
echo.
echo Starting Flask server...
echo Open your browser at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
python app.py
pause
