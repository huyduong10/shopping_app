const advanceProposalService = require('../services/advanceProposalService');

class AdvanceProposalController {
  async create(req, res) {
    try {
      const proposal = await advanceProposalService.create(req.user._id, req.body);
      res.status(201).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const proposals = await advanceProposalService.getAll(
        req.user._id,
        req.user.role,
        req.user.department._id || req.user.department
      );
      res.status(200).json({ success: true, data: proposals });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const proposal = await advanceProposalService.getById(req.params.id);
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async approve(req, res) {
    try {
      const proposal = await advanceProposalService.approve(
        req.params.id,
        req.user._id,
        req.body.comment
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async reject(req, res) {
    try {
      const proposal = await advanceProposalService.reject(
        req.params.id,
        req.user._id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async accountingApproveAndDisburse(req, res) {
    try {
      const proposal = await advanceProposalService.accountingApproveAndDisburse(
        req.params.id,
        req.user._id,
        req.body.amount,
        req.body.note
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async submitSettlement(req, res) {
    try {
      const proposal = await advanceProposalService.submitSettlement(
        req.params.id,
        req.user._id,
        req.body
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async resubmit(req, res) {
    try {
      const proposal = await advanceProposalService.resubmit(
        req.params.id,
        req.user._id,
        req.body
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async rejectSettlement(req, res) {
    try {
      const proposal = await advanceProposalService.rejectSettlement(
        req.params.id,
        req.user._id,
        req.body.reason
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async confirmSettlement(req, res) {
    try {
      const proposal = await advanceProposalService.confirmSettlement(
        req.params.id,
        req.user._id,
        req.body.comment
      );
      res.status(200).json({ success: true, data: proposal });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AdvanceProposalController();
