import "./LogoutModal.css";

export default function LogoutModal({ isOpen, onClose, onLogout }) {
  if (!isOpen) return null;

  return (
    <div className="logout-overlay" onClick={onClose}>
      <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Logout</h3>
        <p>Are you sure you want to logout?</p>
        <div className="logout-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
