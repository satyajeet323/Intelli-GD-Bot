function Req($label, $uri, $body) {
    Write-Host $label
    try {
        $r = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body ($body | ConvertTo-Json)
        if ($r.token) { Write-Host "  OK — token issued, user=$($r.user.name), plan=$($r.user.plan)" }
        else { Write-Host "  OK — $($r.message)" }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $json = $reader.ReadToEnd() | ConvertFrom-Json
        $errs = if ($json.errors) { " | " + (($json.errors | ForEach-Object { "$($_.field): $($_.message)" }) -join ", ") } else { "" }
        Write-Host "  FAIL HTTP $code — $($json.message)$errs"
    }
}

Req "1. Validation errors (empty name, bad email, short pass)" "http://localhost:4000/api/auth/register" @{name="";email="bad-email";password="12"}
Req "2. Duplicate email" "http://localhost:4000/api/auth/register" @{name="Test";email="test@gdbot.com";password="test123"}
Req "3. Wrong password" "http://localhost:4000/api/auth/login" @{email="test@gdbot.com";password="wrongpass"}
Req "4. Non-existent user" "http://localhost:4000/api/auth/login" @{email="nobody@gdbot.com";password="test123"}
Req "5. Valid login" "http://localhost:4000/api/auth/login" @{email="test@gdbot.com";password="test123"}
