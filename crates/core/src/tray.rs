use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrayAction {
    ToggleWindow,
    ComposeNew,
    Reload,
    Quit,
}

impl TrayAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "toggle" => Some(Self::ToggleWindow),
            "compose" => Some(Self::ComposeNew),
            "reload" => Some(Self::Reload),
            "quit" => Some(Self::Quit),
            _ => None,
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Self::ToggleWindow => "toggle",
            Self::ComposeNew => "compose",
            Self::Reload => "reload",
            Self::Quit => "quit",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_action_roundtrip() {
        let actions = [
            TrayAction::ToggleWindow,
            TrayAction::ComposeNew,
            TrayAction::Reload,
            TrayAction::Quit,
        ];

        for action in actions {
            let id = action.id();
            assert_eq!(TrayAction::from_id(id), Some(action));
        }

        assert_eq!(TrayAction::from_id("unknown"), None);
    }
}
