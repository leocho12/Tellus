$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$endpoint = 'https://tellus-dev-board.equaljive2.chatgpt.site/agent-mcp'
$versions = @('2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05')

function Send-Response($message) {
    [Console]::WriteLine((ConvertTo-Json -InputObject $message -Depth 20 -Compress))
}

function Get-BoardKey {
    if ($env:TELLUS_BOARD_ACCESS) { return $env:TELLUS_BOARD_ACCESS }
    $stored = [Environment]::GetEnvironmentVariable('TELLUS_BOARD_ACCESS_DPAPI', 'User')
    if (!$stored) { throw 'Tellus board credentials are missing for this Windows user.' }
    Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1')
    $secure = ConvertTo-SecureString $stored
    return (New-Object System.Net.NetworkCredential('', $secure)).Password
}

while ($null -ne ($line = [Console]::ReadLine())) {
    try {
        $message = ConvertFrom-Json -InputObject $line
    } catch {
        Send-Response @{jsonrpc='2.0'; id=$null; error=@{code=-32700; message='Invalid JSON'}}
        continue
    }
    if (!$message -or !$message.PSObject.Properties['id']) { continue }
    $reply = @{jsonrpc='2.0'; id=$message.id}
    try {
        switch ($message.method) {
            'initialize' {
                $version = $message.params.protocolVersion
                if ($version -notin $versions) { $version = $versions[0] }
                $reply.result = @{
                    protocolVersion=$version
                    serverInfo=@{name='tellus-board'; version='1.0.0'}
                    capabilities=@{tools=@{}}
                }
            }
            'ping' { $reply.result = @{} }
            { $_ -in 'tools/list', 'tools/call' } {
                $key = Get-BoardKey
                $headers = @{'OAI-Sites-Authorization'="Bearer $key"; 'X-Tellus-Board-Key'=$key}
                $response = Invoke-WebRequest -Uri $endpoint -Method Post -Headers $headers `
                    -Body $utf8.GetBytes($line) -ContentType 'application/json; charset=utf-8' `
                    -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 20
                $reader = New-Object System.IO.StreamReader($response.RawContentStream, $utf8)
                try { [Console]::WriteLine($reader.ReadToEnd()) } finally { $reader.Dispose() }
                continue
            }
            default { $reply.error = @{code=-32601; message='Method not found'} }
        }
        if ($reply.ContainsKey('result') -or $reply.ContainsKey('error')) { Send-Response $reply }
    } catch {
        $reply.error = @{code=-32000; message=$_.Exception.Message}
        Send-Response $reply
    }
}
