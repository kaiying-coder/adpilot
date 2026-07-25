from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "workflow-demo.gif"
W, H = 1200, 675
BG, PAPER, INK = "#f3f5f2", "#ffffff", "#17201d"
GREEN, DEEP, MINT, LIME = "#1a6b52", "#102e25", "#eaf5ef", "#d9f564"
MUTED, LINE, ORANGE, RED = "#6e7773", "#dfe6e2", "#d98b43", "#bd5547"
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
FONT_ZH = "/System/Library/Fonts/Hiragino Sans GB.ttc"


def font(size, bold=False, zh=False):
    path = FONT_ZH if zh else FONT
    try:
        return ImageFont.truetype(path, size=size, index=1 if bold else 0)
    except OSError:
        return ImageFont.load_default()


def rounded(draw, box, radius=16, fill=PAPER, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def base(step, title, subtitle):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 220, H), fill=DEEP)
    rounded(draw, (28, 28, 62, 62), 9, LIME)
    draw.text((39, 34), "A", fill=DEEP, font=font(19, True))
    draw.text((74, 33), "AdPilot", fill="white", font=font(22, True))
    nav = ["Overview", "Incidents", "Agent runs", "Knowledge", "Evaluations"]
    for index, item in enumerate(nav):
        y = 112 + index * 48
        if index == step:
            rounded(draw, (24, y - 9, 196, y + 28), 9, "#1e473a")
        draw.text((42, y), item, fill="white" if index == step else "#adc3ba", font=font(14, index == step))
    draw.ellipse((34, 604, 44, 614), fill="#76d68d")
    draw.text((52, 600), "All systems operational", fill="#9fb7ae", font=font(10))
    draw.text((258, 36), "AI ADVERTISING OPERATIONS", fill=GREEN, font=font(11, True))
    draw.text((258, 60), title, fill=INK, font=font(30, True))
    draw.text((258, 103), subtitle, fill=MUTED, font=font(14))
    draw.text((1090, 42), f"0{step + 1}/05", fill=GREEN, font=font(13, True))
    return image, draw


def overview():
    image, draw = base(0, "Detect the signal", "Live campaign metrics are compared with reproducible historical baselines.")
    labels = [("Revenue", "$284.6K", "+4.2%", GREEN), ("Detected anomalies", "03", "3 in scope", ORANGE), ("CTR", "2.41%", "-17.8%", RED), ("ROAS", "3.86x", "Live", GREEN)]
    for i, (label, value, delta, color) in enumerate(labels):
        x = 258 + i * 220
        rounded(draw, (x, 148, x + 198, 270), 13, PAPER, LINE)
        draw.text((x + 16, 166), label, fill=MUTED, font=font(12))
        draw.text((x + 16, 204), value, fill=INK, font=font(27, True))
        rounded(draw, (x + 126, 165, x + 182, 188), 10, MINT if color == GREEN else "#fff0e4")
        draw.text((x + 136, 171), delta, fill=color, font=font(9, True))
    rounded(draw, (258, 290, 1118, 610), 14, PAPER, LINE)
    draw.text((280, 312), "Revenue trend · 14 days", fill=INK, font=font(16, True))
    values = [58, 71, 66, 78, 84, 90, 86, 94, 88, 96, 92, 70, 55, 62]
    for i, value in enumerate(values):
        x = 286 + i * 55
        color = RED if i in (11, 12) else "#5da788"
        draw.rounded_rectangle((x, 570 - value * 2.1, x + 25, 570), radius=4, fill=color)
    return image


def incidents():
    image, draw = base(1, "Prioritize three standard incidents", "Impact, severity, market, device, and evidence stay visible in one queue.")
    cards = [
        ("P1", "US mobile CTR decline", "INC-2407 · Landing-page latency regression", "-17.8%", "$18,400/day"),
        ("P1", "DE desktop spend spike", "INC-2411 · Incorrect bid multiplier", "+34.2%", "$12,900/day"),
        ("P2", "UK mobile revenue decline", "INC-2414 · Conversion-tag change", "-21.4%", "$9,600/day"),
    ]
    for i, (sev, title, detail, delta, impact) in enumerate(cards):
        y = 155 + i * 142
        rounded(draw, (258, y, 1118, y + 112), 14, PAPER, GREEN if i == 0 else LINE, 2 if i == 0 else 1)
        rounded(draw, (280, y + 22, 324, y + 54), 7, "#fee8e5" if sev == "P1" else "#fff0dc")
        draw.text((292, y + 30), sev, fill=RED if sev == "P1" else ORANGE, font=font(11, True))
        draw.text((350, y + 20), title, fill=INK, font=font(17, True))
        draw.text((350, y + 52), detail, fill=MUTED, font=font(12))
        draw.text((350, y + 78), impact + " estimated impact", fill=GREEN, font=font(11, True))
        draw.text((1016, y + 41), delta, fill=RED, font=font(17, True))
    return image


def agent():
    image, draw = base(2, "Investigate with constrained tools", "The agent exposes every tool call, data source, and verification step.")
    steps = [
        ("01", "query_metrics", "CTR is 17.8% below the 7-day baseline"),
        ("02", "slice_dimensions", "Impact isolated to US · Mobile"),
        ("03", "retrieve_runbook", "RB-014 §1 + CASE-2319 §1"),
        ("04", "query_change_log", "Landing release matches anomaly start"),
        ("05", "verify_hypothesis", "Latency regression confirmed"),
    ]
    rounded(draw, (258, 148, 1118, 570), 14, PAPER, LINE)
    for i, (number, tool, result) in enumerate(steps):
        y = 175 + i * 72
        rounded(draw, (282, y, 320, y + 38), 9, GREEN if i < 4 else LIME)
        draw.text((293, y + 11), "✓" if i < 4 else number, fill="white" if i < 4 else DEEP, font=font(12, True))
        draw.text((344, y), tool, fill=GREEN, font=font(14, True))
        draw.text((344, y + 27), result, fill=MUTED, font=font(12))
        draw.text((1025, y + 11), "VERIFIED", fill=GREEN, font=font(10, True))
        if i < 4:
            draw.line((301, y + 38, 301, y + 71), fill=LINE, width=2)
    return image


def knowledge():
    image, draw = base(3, "Ground every conclusion", "Approved runbooks and historical cases are retrieved with inspectable citations.")
    hits = [
        ("RB-014 §1", "CTR decline investigation runbook", "Baseline → dimensions → latency → release correlation"),
        ("CASE-2319 §1", "Mobile landing-page latency incident", "870 ms regression; CTR recovered after approved rollback"),
        ("METRIC-CTR §1", "Click-through rate definition", "Clicks ÷ impressions; inspect market, device, campaign"),
    ]
    rounded(draw, (258, 148, 1118, 205), 12, PAPER, LINE)
    draw.text((280, 166), "latency ctr mobile release", fill=INK, font=font(14))
    rounded(draw, (1000, 160, 1095, 193), 9, GREEN)
    draw.text((1022, 169), "Search", fill="white", font=font(11, True))
    for i, (cite, title, excerpt) in enumerate(hits):
        y = 226 + i * 116
        rounded(draw, (258, y, 1118, y + 96), 13, PAPER, LINE)
        rounded(draw, (280, y + 18, 382, y + 43), 10, MINT)
        draw.text((292, y + 25), cite, fill=GREEN, font=font(10, True))
        draw.text((410, y + 16), title, fill=INK, font=font(16, True))
        draw.text((410, y + 49), excerpt, fill=MUTED, font=font(12))
        draw.text((1035, y + 37), f"{98 - i * 7}%", fill=GREEN, font=font(14, True))
    return image


def evaluation():
    image, draw = base(4, "Approve, monitor, and evaluate", "Risky actions require a human; quality and cost are measured against ground truth.")
    rounded(draw, (258, 148, 1118, 260), 14, "#fff8ed", "#efd2a6")
    draw.text((282, 169), "Human approval required", fill="#8e5b20", font=font(17, True))
    draw.text((282, 204), "Rollback landing release · simulated execution only", fill=MUTED, font=font(12))
    rounded(draw, (916, 178, 1090, 226), 10, "#8e5b20")
    draw.text((948, 194), "Approve action", fill="white", font=font(12, True))
    metrics = [("Precision", "100%"), ("Recall", "100%"), ("F1 score", "100%"), ("Cost / run", "$0.00")]
    for i, (label, value) in enumerate(metrics):
        x = 258 + i * 220
        rounded(draw, (x, 286, x + 198, 416), 13, PAPER, LINE)
        draw.text((x + 18, 310), label, fill=MUTED, font=font(12))
        draw.text((x + 18, 348), value, fill=INK, font=font(28, True))
        draw.text((x + 18, 386), "Ground-truth suite", fill=GREEN, font=font(10, True))
    rounded(draw, (258, 444, 1118, 586), 14, PAPER, LINE)
    draw.text((282, 466), "Outcome", fill=GREEN, font=font(11, True))
    draw.text((282, 494), "3 incidents detected · 0 false positives · 5/5 tools succeeded", fill=INK, font=font(18, True))
    draw.text((282, 532), "Auditable, reproducible, safe by design.", fill=MUTED, font=font(13))
    return image


frames = [overview(), incidents(), agent(), knowledge(), evaluation()]
frames[0].save(
    OUTPUT,
    save_all=True,
    append_images=frames[1:],
    duration=[1700, 1700, 1900, 1900, 2200],
    loop=0,
    optimize=True,
    disposal=2,
)
print(OUTPUT)
