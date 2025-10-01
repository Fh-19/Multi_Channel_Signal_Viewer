import torch
import torch.nn as nn

# Define the same model architecture you used in training
class EEGNet(nn.Module):
    def __init__(self, n_classes=5, n_channels=19, n_samples=256):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, (n_channels, 5))
        self.relu = nn.ReLU()
        self.pool = nn.AdaptiveMaxPool2d((1, 50))
        self.fc = nn.Linear(16 * 50, n_classes)

    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.pool(x)
        x = x.view(x.size(0), -1)
        return self.fc(x)

# Load model
def load_trained_model(model_path: str, device="cpu"):
    model = EEGNet()
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)         
    model.eval()
    return model
