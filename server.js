const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIME 타입 매핑
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // 기본 경로를 constraint-debug.html로 리다이렉트
    let filePath = req.url === '/' ? './constraint-debug.html' : '.' + req.url;
    
    // 파일 확장자 추출
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 파일 읽기
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 파일이 없으면 404 페이지 생성
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>404 - 페이지를 찾을 수 없습니다</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                background-color: #f5f5f5;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .container {
                                text-align: center;
                                background: white;
                                padding: 40px;
                                border-radius: 8px;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            }
                            h1 { color: #dc2626; margin-bottom: 20px; }
                            p { color: #666; margin-bottom: 20px; }
                            a {
                                color: #2563eb;
                                text-decoration: none;
                                font-weight: 500;
                            }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>🔍 404 - 페이지를 찾을 수 없습니다</h1>
                            <p>요청하신 페이지를 찾을 수 없습니다.</p>
                            <p><a href="/">제약조건 디버깅 화면으로 돌아가기</a></p>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                // 서버 오류
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="ko">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>500 - 서버 오류</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                background-color: #f5f5f5;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .container {
                                text-align: center;
                                background: white;
                                padding: 40px;
                                border-radius: 8px;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            }
                            h1 { color: #dc2626; margin-bottom: 20px; }
                            p { color: #666; margin-bottom: 20px; }
                            a {
                                color: #2563eb;
                                text-decoration: none;
                                font-weight: 500;
                            }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>⚠️ 500 - 서버 오류</h1>
                            <p>서버에서 오류가 발생했습니다.</p>
                            <p><a href="/">제약조건 디버깅 화면으로 돌아가기</a></p>
                        </div>
                    </body>
                    </html>
                `);
            }
        } else {
            // 성공적으로 파일을 읽었을 때
            res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`📁 제약조건 디버깅 화면: http://localhost:${PORT}/`);
    console.log(`📁 주간 시수 비교 테이블: http://localhost:${PORT}/test.html`);
    console.log(`⏹️  서버를 중지하려면 Ctrl+C를 누르세요.`);
});

// 서버 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 서버를 종료합니다...');
    server.close(() => {
        console.log('✅ 서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
}); 